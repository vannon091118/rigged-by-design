#!/usr/bin/env node
/**
 * Promote: gruene PR-Staende mergen. Rot wird ein Issue, kein Dump auf
 * `integration`; Timeout und Abbruch sind REMOTE_CI und kein roter Stand.
 *
 * Ein Lauf pro CI-Ergebnis. Die Wahrheit liegt im Branch und in Labels, nie in
 * der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden
 * Lauf, ein einzelner Lauf arbeitet deshalb den ganzen Rueckstand ab.
 *
 * `integration` ist der letzte Notausgang: sie laeuft nur, wenn ein Mensch sie
 * ueber `workflow_dispatch` mit `integrate=true` anfordert.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IDENTITY } from './lib/identity.mjs';
import { loadClaimsStrict } from './lib/lane-claims.mjs';

const MAIN = 'main';
const INTEGRATION = 'integration';
const RED_LABEL = 'integration/rot';
const CONFLICT_LABEL = 'integration/konflikt';
const branch = process.env.HEAD_BRANCH ?? '';
const conclusion = process.env.CONCLUSION ?? '';
const hasToken = Boolean(process.env.GH_TOKEN);
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const OWNER = REPO.split('/')[0];
// Ein Merge mit dem Workflow-Token startet keinen Workflow; das eigene Token
// ist die Stufe, die CI, Tag und APK wieder in Gang setzt.
const elevated = Boolean(process.env.PROMOTE_TOKEN);
// Notausgang nur auf Anforderung, nie automatisch bei jedem roten Lauf.
const integrateRequested = ['1', 'true'].includes(String(process.env.INTEGRATE ?? '').toLowerCase());
// Timeout, Abbruch und Startfehler sind REMOTE_CI: CI erneut starten, nicht integrieren.
const REMOTE_CONCLUSIONS = new Set(['timed_out', 'cancelled', 'startup_failure']);

const run = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};
const git = (args) => run('git', args);
const gh = (args) => (hasToken ? run('gh', args) : null);
const log = (message) => console.log(`promote: ${message}`);
const warn = (message) => console.log(`::warning::promote: ${message}`);

const subject = (ref) => git(['log', '-1', '--pretty=%s', ref]) ?? `Promotion ${ref}`;
const SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);

/**
 * Commit-Text mit Pflichtstruktur. Ein fremder Body ohne Sektionen wuerde
 * `verify-commit-msg --head` auf main rot machen; die Promotion baut ihn
 * deshalb selbst, statt sich auf den PR-Text zu verlassen.
 */
function body(ref) {
  const raw = git(['log', '-1', '--pretty=%b', ref]) ?? '';
  if (raw.includes(SECTIONS[0]) && raw.includes(SECTIONS[2])) return raw;
  const bullets = (git(['log', '-1', '--pretty=%B', ref]) ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((line) => `- ${line.replace(/^[-*]\s+/, '')}`);
  return [SECTIONS[0], ...bullets, '', SECTIONS[1], '- Automatisch aus dem CI-Ergebnis gehoben; Inhalt unveraendert.', '', SECTIONS[2], `- Promotion von \`${branch}\` nach \`${MAIN}\`.`, ''].join('\n');
}

function openPr(head = branch) {
  const raw = gh(['pr', 'list', '--head', head, '--state', 'open', '--json', 'number', '--jq', '.[0].number']);
  return raw && /^\d+$/.test(raw) ? raw : '';
}

function label(number, name, note) {
  if (!number) return;
  gh(['label', 'create', name, '--color', 'd93f0b', '--description', note]);
  gh(['pr', 'edit', number, '--add-label', name]);
}

function ensurePr() {
  const existing = openPr();
  if (existing) return existing;
  const dir = mkdtempSync(join(tmpdir(), 'rbd-promote-'));
  const bodyFile = join(dir, 'pr-body.md');
  writeFileSync(bodyFile, `${body(`origin/${branch}`)}\n`);
  if (gh(['pr', 'create', '--base', MAIN, '--head', branch, '--title', subject(`origin/${branch}`), '--body-file', bodyFile]) === null) return '';
  return openPr();
}

const runGhJson = (args) => {
  const raw = gh(args);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

function openPullRequests() {
  return runGhJson(['pr', 'list', '--state', 'open', '--base', MAIN, '--limit', '100', '--json', 'number,title,body,headRefName,headRefOid,baseRefName,mergeStateStatus,isDraft,headRepositoryOwner']) ?? [];
}

function currentPullRequest(number) {
  return runGhJson(['pr', 'view', String(number), '--json', 'number,title,body,headRefName,headRefOid,baseRefName,mergeStateStatus,isDraft,headRepositoryOwner']);
}

function hasRequiredCheck(sha) {
  const result = runGhJson(['api', `repos/${REPO}/commits/${sha}/check-runs`]);
  const checks = (result?.check_runs ?? []).filter((check) => check.name === 'Fail-Closed Gates' && check.status === 'completed');
  checks.sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  return checks.at(-1)?.conclusion === 'success';
}

function dependencyReady(claim, claims) {
  for (const id of claim.dependencies ?? []) {
    const dependency = claims.find((entry) => entry.id === id);
    if (!dependency) return false;
    if (dependency.status === 'merged' || dependency.branchStatus === 'merged') continue;
    const merged = runGhJson(['pr', 'list', '--state', 'merged', '--head', `${OWNER}:${dependency.branch}`, '--limit', '1', '--json', 'number']);
    if (!Array.isArray(merged) || merged.length === 0) return false;
  }
  return true;
}

function validBody(text) {
  return SECTIONS.every((section) => String(text ?? '').includes(section));
}

function dispatch(workflow, fields = []) {
  const args = ['workflow', 'run', workflow, '--ref', MAIN, ...fields.flatMap(([key, value]) => ['--field', `${key}=${value}`])];
  if (gh(args) === null) warn(`${workflow}: Dispatch fehlgeschlagen`);
  else log(`${workflow}: ohne PROMOTE_TOKEN explizit angestossen`);
}

async function mergePullRequest(pr) {
  const current = currentPullRequest(pr.number);
  if (!current || current.headRefOid !== pr.headRefOid) return 'head-moved';
  if (current.baseRefName !== MAIN || current.isDraft) return 'not-ready';
  if (current.mergeStateStatus === 'BEHIND' || current.mergeStateStatus === 'DIRTY') return 'needs-sync';
  if (current.mergeStateStatus !== 'CLEAN') return 'not-ready';
  if (!validBody(current.body)) return 'invalid-pr-body';
  if (!hasRequiredCheck(current.headRefOid)) return 'check-pending';

  const response = await fetch(`https://api.github.com/repos/${REPO}/pulls/${pr.number}/merge`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'rigged-by-design-promotion-queue',
    },
    body: JSON.stringify({
      sha: current.headRefOid,
      merge_method: 'squash',
      commit_title: `${current.title} (#${pr.number})`,
      commit_message: current.body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.merged !== true) {
    warn(`PR #${pr.number}: GitHub lehnte den Merge ab (${result.message ?? response.status})`);
    return 'merge-rejected';
  }

  log(`PR #${pr.number} (${current.headRefName}) mit Status am aktuellen Head gemergt: ${result.sha}`);
  const deleted = gh(['api', '--method', 'DELETE', `repos/${REPO}/git/refs/heads/${current.headRefName}`]);
  if (deleted === null) warn(`${current.headRefName}: Merge ist erfolgt; Remote-Branch konnte nicht geloescht werden`);
  else log(`${current.headRefName}: gemergten Remote-Branch geloescht`);

  if (!elevated) {
    dispatch('auto-version-release.yml', [['verified_sha', result.sha], ['verified_head', current.headRefOid]]);
    dispatch('branch-sync.yml');
    dispatch('pr-watcher.yml', [['sweep_green', 'true']]);
  }
  return 'merged';
}

async function promoteQueue() {
  let claims;
  try {
    claims = loadClaimsStrict();
  } catch (error) {
    warn(`Claim-Register unlesbar; Promotion fail-closed (${error instanceof Error ? error.message : 'unbekannt'})`);
    return;
  }
  const active = claims.filter((claim) => ['open', 'active', 'sync-pending'].includes(claim.status)
    && ['active', 'closing'].includes(claim.branchStatus ?? 'active')
    && claim.branch !== MAIN && claim.branch !== INTEGRATION);
  const owners = new Set();
  for (const claim of active) {
    if (owners.has(claim.owner)) {
      warn(`Doppelter aktiver Owner ${claim.owner}; Promotion bleibt gesperrt`);
      return;
    }
    owners.add(claim.owner);
  }

  const prs = openPullRequests().sort((a, b) => a.number - b.number);
  if (!Array.isArray(prs)) {
    warn('Offene PRs konnten nicht gelesen werden');
    return;
  }
  for (const pr of prs) {
    const claim = active.find((entry) => entry.branch === pr.headRefName);
    if (!claim || pr.baseRefName !== MAIN || pr.isDraft || pr.headRepositoryOwner?.login !== OWNER) continue;
    if (!dependencyReady(claim, claims)) {
      log(`PR #${pr.number}: wartet auf Lane-Abhaengigkeit`);
      continue;
    }
    if (!hasRequiredCheck(pr.headRefOid)) continue;
    const outcome = await mergePullRequest(pr);
    if (outcome === 'needs-sync') {
      dispatch('branch-sync.yml');
      log(`PR #${pr.number}: Main-Sync vor Promotion eingeplant`);
      continue;
    }
    if (outcome === 'merged') return;
    if (outcome === 'invalid-pr-body') warn(`PR #${pr.number}: Pflichtsektionen im PR-Body fehlen`);
    if (outcome === 'head-moved') log(`PR #${pr.number}: Head wurde waehrend der Pruefung bewegt; naechster Lauf prueft neu`);
  }
  log('Keine aktuelle, gruene und abhaengigkeitsbereite Lane zum Mergen gefunden');
}

/** Offene Staende, die als rot markiert sind - plus der aktuelle Lauf. */
function redBranches() {
  const raw = gh(['pr', 'list', '--label', RED_LABEL, '--state', 'open', '--json', 'headRefName', '--jq', '.[].headRefName']) ?? '';
  const fromLabel = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [...new Set([...fromLabel, branch])].filter((name) => name && name !== MAIN);
}

/** Die acht Meta-Dateien: hier sind Konflikte meist nur Marker und Version. */
const META_FILES = Object.freeze([
  'AGENTS.md',
  'docs/INVENTORY.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVTAGEBUCH.md',
  'docs/ROADMAP.md',
  'package.json',
  'pnpm-lock.yaml',
]);

/** Eine Zeile, die das System schreibt, nicht ein Mensch. */
const SYSTEM_LINE = /^(?:<!--\s*rbd-doc:.*-->|"version":\s*".*",?)$/;

const conflicted = () => (git(['diff', '--name-only', '--diff-filter=U']) ?? '').split(/\r?\n/).filter(Boolean);

/**
 * Meta-Konflikte nur dann automatisch loesen, wenn jede Konfliktzeile eine
 * Systemzeile ist (Doku-Marker oder Versionsnummer). Ein inhaltlicher Konflikt
 * in derselben Datei bleibt beim Agenten - sonst wuerde still Inhalt verloren.
 */
function resolveMetaConflicts() {
  for (const file of conflicted()) {
    if (!META_FILES.includes(file)) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const blocks = [...text.matchAll(/^<{7}.*\n([\s\S]*?)^={7}.*\n([\s\S]*?)^>{7}.*$/gm)];
    if (blocks.length === 0) continue;
    const mechanical = blocks.every(([, ours, theirs]) =>
      [...ours.split('\n'), ...theirs.split('\n')]
        .map((line) => line.trim())
        .filter(Boolean)
        .every((line) => SYSTEM_LINE.test(line)),
    );
    if (!mechanical) continue;
    if (git(['checkout', '--ours', '--', file]) === null) continue;
    git(['add', '--', file]);
    log(`Meta-Konflikt in ${file} automatisch geloest (Marker/Version)`);
  }
  return conflicted();
}

/** Rot: Stand auf die Integrationsbranch legen; ein Code-Konflikt wird nicht erzwungen. */
function integrate(name, attempt = 0) {
  const number = openPr(name);
  let merged = git(['merge', '--no-ff', `origin/${name}`, '-m', `Integration: ${subject(`origin/${name}`)}`]);
  if (merged === null) {
    // Erst der mechanische Teil (Marker/Version), dann erst aufgeben.
    const remaining = resolveMetaConflicts();
    if (remaining.length === 0) merged = git(['commit', '--no-edit']);
  }
  if (merged === null) {
    git(['merge', '--abort']);
    label(number, CONFLICT_LABEL, 'Textkonflikt mit der Integrationsbranch');
    gh(['pr', 'comment', number, '--body', `Die Integrationsbranch \`${INTEGRATION}\` steht mit \`${name}\` in Konflikt. Der Stand wurde nicht erzwungen; bitte \`git merge origin/${INTEGRATION}\` aufloesen.`]);
    warn(`${name} kollidiert mit ${INTEGRATION}; nichts ueberschrieben`);
    return;
  }
  if (git(['push', 'origin', `HEAD:${INTEGRATION}`]) !== null) {
    gh(['pr', 'edit', number, '--remove-label', RED_LABEL]);
    log(`roter Stand ${name} auf ${INTEGRATION} gelegt`);
    return;
  }
  // Rueckstand: neu aufsetzen und erneut mergen. Idempotent, weil ein bereits
  // enthaltener Branch nur "Already up to date" meldet.
  git(['fetch', 'origin', `+refs/heads/${INTEGRATION}:refs/remotes/origin/${INTEGRATION}`]);
  git(['reset', '--hard', `origin/${INTEGRATION}`]);
  if (attempt < 2) integrate(name, attempt + 1);
  else warn(`${name} liess sich nach drei Versuchen nicht auf ${INTEGRATION} legen`);
}

function promoteRed() {
  git(['fetch', 'origin', `+refs/heads/${MAIN}:refs/remotes/origin/${MAIN}`]);
  const exists = git(['rev-parse', '--verify', `refs/remotes/origin/${INTEGRATION}`]) !== null;
  if (exists) git(['fetch', 'origin', `+refs/heads/${INTEGRATION}:refs/remotes/origin/${INTEGRATION}`]);
  git(['checkout', '-B', INTEGRATION, `origin/${exists ? INTEGRATION : MAIN}`]);
  git(['config', 'user.name', IDENTITY.name]);
  git(['config', 'user.email', IDENTITY.email]);
  for (const name of redBranches()) {
    git(['fetch', `+refs/heads/${name}:refs/remotes/origin/${name}`]);
    integrate(name);
  }
}

if (!branch || branch === MAIN) {
  log('main-Run: nur explizite Dispatches der Folge-Workflows');
} else if (conclusion === 'success') {
  if (!openPr(branch)) {
    const number = ensurePr();
    if (number) log(`PR #${number} fuer ${branch} angelegt`);
    else warn(`kein PR fuer ${branch}; Promotion uebersprungen`);
  }
  await promoteQueue();
} else if (REMOTE_CONCLUSIONS.has(conclusion)) {
  const number = openPr();
  if (number) {
    label(number, 'ci/remote', 'Timeout oder Abbruch: CI erneut starten (REMOTE_CI)');
    gh(['pr', 'comment', number, '--body', `Der Lauf endete mit \`${conclusion}\`. Das ist REMOTE_CI (ERR-4014/ERR-4016): CI erneut starten. Kein \`BLOCKED\`, kein Dump auf \`${INTEGRATION}\`.`]);
  }
  log(`REMOTE_CI: ${conclusion} - kein roter Stand, kein Integrations-Dump`);
} else if (conclusion === 'failure') {
  const number = openPr();
  if (number) label(number, RED_LABEL, 'Roter Stand: Issue und Label, Integration nur auf Anforderung');
  if (integrateRequested) {
    promoteRed();
  } else {
    log('rot: Issue und Label gesetzt; `integration` nur auf Anforderung (Dispatch mit integrate=true)');
  }
} else {
  log(`Ergebnis ${conclusion || 'unbekannt'}: nichts zu tun`);
}
