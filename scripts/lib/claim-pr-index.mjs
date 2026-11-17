/**
 * Merge-Beleg-Index: gemergte Pull Requests je Head-Branch.
 *
 * `gh` ist die Live-Quelle; fehlt es, liest der lokale Index. Ist auch der
 * nicht lesbar, bleibt das Ergebnis `null` und niemand behauptet einen Beleg.
 */
import { execFileSync } from 'node:child_process';
import { MERGED_INDEX_PATH, mergedIndexGroups, readMergedIndex } from './merged-index.mjs';

const FULL_SHA = /^[0-9a-f]{40}$/;
const defaultGh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Gemergte Pull Requests je Head-Branch; ein Branch darf mehrere Fassungen haben. */
export function mergedPullRequestGroups({
  gh = defaultGh,
  baseRef = 'main',
  root,
  file = MERGED_INDEX_PATH,
  indexData,
} = {}) {
  try {
    const output = gh([
      'pr', 'list', '--state', 'merged', '--limit', '200', '--json',
      'baseRefName,headRefName,headRefOid,isCrossRepository,number,mergeCommit,url',
    ]);
    const groups = new Map();
    for (const entry of JSON.parse(output)) {
      if (!entry?.headRefName || !entry?.number) continue;
      if (entry.baseRefName !== baseRef) continue;
      if (entry.isCrossRepository !== false) continue;
      if (!FULL_SHA.test(String(entry.headRefOid ?? ''))) continue;
      const list = groups.get(entry.headRefName) ?? [];
      list.push({
        number: entry.number,
        headRefOid: entry.headRefOid,
        mergeCommit: entry.mergeCommit?.oid ?? null,
        url: entry.url ?? null,
      });
      groups.set(entry.headRefName, list);
    }
    return groups;
  } catch {
    const index = indexData ?? readMergedIndex(root === undefined ? { file } : { root, file });
    return mergedIndexGroups(index);
  }
}

/** Eindeutige Branch-Namen; mehrdeutige Namen bleiben nur in den Gruppen. */
export function mergedPullRequestIndex({
  gh = defaultGh,
  baseRef = 'main',
  root,
  file = MERGED_INDEX_PATH,
  indexData,
} = {}) {
  const groups = mergedPullRequestGroups({ gh, baseRef, root, file, indexData });
  if (groups === null) return null;
  const index = new Map();
  for (const [branch, list] of groups) {
    if (list.length === 1) index.set(branch, list[0]);
  }
  return index;
}

/** Alle Branch-Koepfe am Remote in einem Aufruf; `null` heisst unerreichbar. */
export function remoteHeads({ git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } = {}) {
  try {
    const output = git(['ls-remote', '--heads', 'origin']);
    const heads = new Map();
    for (const line of String(output ?? '').split(/\r?\n/)) {
      const [sha = '', ref = ''] = line.trim().split(/\s+/);
      if (!sha || !ref.startsWith('refs/heads/')) continue;
      heads.set(ref.slice('refs/heads/'.length), sha);
    }
    return heads;
  } catch {
    return null;
  }
}
