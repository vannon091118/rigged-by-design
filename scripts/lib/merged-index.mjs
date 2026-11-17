/**
 * Deterministischer Merge-Beleg-Index aus der lokalen Git-Historie.
 *
 * Der Index ist die offline lesbare Zweitquelle fuer `claim-evidence`, wenn
 * `gh` oder ein GitHub-Token fehlt. Er enthaelt nur Merge-Commits mit dem
 * Standard-Subject `Merge pull request #N from owner/branch`; Squash-Merges
 * bleiben der lokalen Baum-Evidenz vorbehalten. Der Index traegt keinen
 * Zeitstempel und wird nach PR-Nummer und Merge-SHA sortiert, damit derselbe
 * Git-Stand immer dieselben Bytes erzeugt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { ROOT } from './report.mjs';

export const MERGED_INDEX_PATH = '.lane-claims/merged-index.json';
export const MERGED_INDEX_VERSION = 1;
const FULL_SHA = /^[0-9a-f]{40}$/;
const MERGE_SUBJECT = /^Merge pull request #(\d+) from ([^/\s]+)\/(.+)$/;

/** Ein Git-Aufruf; Tests setzen dieselbe Signatur mit eigener Implementierung. */
const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Owner aus einer GitHub-Remote-URL; unbekannt bleibt `null` (fail-closed). */
export function remoteOwner(git = defaultGit) {
  try {
    const url = git(['config', '--get', 'remote.origin.url']);
    const match = String(url).match(/github\.com[:/]([^/]+)\//i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Zerlegt ein Merge-Subject; `null` bei jedem anderen Commit-Titel. */
export function parseMergeSubject(subject) {
  const match = String(subject ?? '').trim().match(MERGE_SUBJECT);
  if (!match) return null;
  const number = Number(match[1]);
  const branch = match[3];
  if (!Number.isSafeInteger(number) || number <= 0 || !branch) return null;
  return { number, owner: match[2], branch };
}

/**
 * Baut den Index aus `git log --merges`. `owner` beschraenkt die Eintraege auf
 * Merge-Commits aus dem eigenen Repository; ohne bekannten Owner wird nichts
 * behauptet und der Index bleibt leer.
 */
export function buildMergedIndex({ baseRef = 'origin/main', git = defaultGit, owner } = {}) {
  const repoOwner = owner ?? remoteOwner(git);
  if (!repoOwner) return { version: MERGED_INDEX_VERSION, source: 'git-merge-commits', entries: [] };
  let output;
  try {
    output = git(['log', '--merges', '--format=%H%x09%P%x09%s', baseRef]);
  } catch {
    // Ein frischer Cloud-Worktree hat oft keinen `origin/main`-Ref. Dann ist
    // HEAD die lokale Wahrheit; ein leerer Index waere kein Beleg, sondern
    // Datenverlust.
    try {
      output = git(['log', '--merges', '--format=%H%x09%P%x09%s', 'HEAD']);
    } catch {
      return { version: MERGED_INDEX_VERSION, source: 'git-merge-commits', entries: [] };
    }
  }
  const entries = [];
  for (const line of String(output ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [mergeSha = '', parents = '', ...subjectParts] = line.split('\t');
    const subject = subjectParts.join('\t');
    const parsed = parseMergeSubject(subject);
    if (!parsed || parsed.owner !== repoOwner) continue;
    const parentShas = parents.trim().split(/\s+/).filter(Boolean);
    const headSha = parentShas[1] ?? '';
    if (!FULL_SHA.test(mergeSha) || !FULL_SHA.test(headSha)) continue;
    entries.push({
      branch: parsed.branch,
      number: parsed.number,
      headSha,
      mergeSha,
    });
  }
  entries.sort(
    (left, right) =>
      left.number - right.number ||
      left.mergeSha.localeCompare(right.mergeSha) ||
      left.branch.localeCompare(right.branch),
  );
  return { version: MERGED_INDEX_VERSION, source: 'git-merge-commits', entries };
}

/** Prueft die Form des Index; ein beschaedigter Index ist kein Beleg. */
export function validateMergedIndex(index) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return false;
  if (index.version !== MERGED_INDEX_VERSION || !Array.isArray(index.entries)) return false;
  return index.entries.every(
    (entry) =>
      entry &&
      typeof entry.branch === 'string' &&
      entry.branch.length > 0 &&
      Number.isSafeInteger(entry.number) &&
      entry.number > 0 &&
      FULL_SHA.test(String(entry.headSha ?? '')) &&
      FULL_SHA.test(String(entry.mergeSha ?? '')),
  );
}

/** Liest den Index; fehlend oder beschaedigt liefert `null` (fail-closed). */
export function readMergedIndex({ root = ROOT, file = MERGED_INDEX_PATH } = {}) {
  const path = join(root, file);
  if (!existsSync(path)) return null;
  try {
    const index = JSON.parse(readFileSync(path, 'utf8'));
    return validateMergedIndex(index) ? index : null;
  } catch {
    return null;
  }
}

/** Verdichtet den Index auf die Map-Form, die `claim-evidence` erwartet. */
export function mergedIndexGroups(index) {
  if (!validateMergedIndex(index)) return null;
  const groups = new Map();
  for (const entry of index.entries) {
    const list = groups.get(entry.branch) ?? [];
    list.push({
      number: entry.number,
      headRefOid: entry.headSha,
      mergeCommit: entry.mergeSha,
      url: null,
    });
    groups.set(entry.branch, list);
  }
  return groups;
}

/** Serialisiert stabil, damit `--check` byte-genau vergleichen kann. */
export function renderMergedIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/**
 * Erzeugt den Index und schreibt ihn nur, wenn er sich vom Arbeitsstand
 * unterscheidet. Mit `check` bleibt der Baum unveraendert und ein veralteter
 * Index wird als Fehler gemeldet.
 */
export function syncMergedIndex({
  root = ROOT,
  file = MERGED_INDEX_PATH,
  baseRef = 'origin/main',
  git = defaultGit,
  owner,
  check = false,
} = {}) {
  const index = buildMergedIndex({ baseRef, git, owner });
  const next = renderMergedIndex(index);
  const path = resolve(root, file);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const currentIndex = (() => {
    if (!current) return null;
    try {
      const parsed = JSON.parse(current);
      return validateMergedIndex(parsed) ? parsed : null;
    } catch {
      return null;
    }
  })();
  // Fail-closed: ein leerer Neuaufbau (fehlender Ref, unbekannter Owner) darf
  // einen belegten Index nicht loeschen. Erst ein gueltiger Neuaufbau ersetzt
  // Belege; ein kaputter oder fehlender Index wird weiterhin geschrieben.
  if (index.entries.length === 0 && currentIndex && currentIndex.entries.length > 0) {
    return { changed: false, index: currentIndex, path };
  }
  if (current === next) return { changed: false, index, path };
  if (check) return { changed: true, index, path };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, 'utf8');
  return { changed: true, index, path };
}
