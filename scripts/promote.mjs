#!/usr/bin/env node
/**
 * Promote: manueller Status-/Notausgang. Der PR-Check ist optional; der Merge
 * nach main erfolgt durch Mensch oder Agent. Rot wird ein Issue, kein Dump auf
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
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IDENTITY } from './lib/identity.mjs';
import {
  describeAutomation,
  mergeAutomation,
  parseNameStatus,
  splitAutomation,
} from './lib/body-sync.mjs';
import { manualDispatchAction, promotionPrListArgs, verifyPromotion } from './lib/promote-guard.mjs';
import { blockerFindings, readTaskContractAtRef, validateTaskContract } from './lib/task-contract.mjs';
import { buildCiState, isSupersededRun, parseCiState, serializeCiState } from './lib/ci-state.mjs';
import { blockedIssuesFrom } from './lib/issue-scope.mjs';
import {
  contractHoldReason,
  labelDiff,
  promotionLabels,
  staleBase,
  validatePlanArtifact,
} from './lib/promotion-state.mjs';

const MAIN = 'main';
const INTEGRATION = 'integration';
const RED_LABEL = 'integration/rot';
const CONFLICT_LABEL = 'integration/konflikt';
const branch = process.env.HEAD_BRANCH ?? '';
const conclusion = process.env.CONCLUSION ?? '';
const hasToken = Boolean(process.env.GH_TOKEN);
const event = process.env.EVENT ?? '';
const headSha = process.env.HEAD_SHA ?? '';
const mode = process.env.MODE ?? '';
// Der PR-Check ist optional; Lauf-ID und Basis bleiben nur als Kontext fuer
// die Statusanzeige erhalten und sind keine Merge-Bedingung.
const ciRunId = process.env.CI_RUN_ID ?? '';
const baseSha = process.env.BASE_SHA ?? '';
const runAttempt = Number(process.env.RUN_ATTEMPT ?? 1) || 1;
const planDir = process.env.CI_PLAN_DIR ?? '.ci-plan';
const repo = process.env.GITHUB_REPOSITORY ?? '';
const owner = repo.split('/')[0] ?? '';
// Nur ein voller SHA ist die Identitaet, die die CI geprueft hat. Ein fehlender
// oder kurzer Wert wird nie als "passt schon" behandelt.
const FULL_SHA = /^[0-9a-f]{40}$/;
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
const RUN_ID = /^\d+$/;

/** Eine paginierte GitHub-Liste; `null` heisst nicht lesbar. */
function listAll(path) {
  const raw = gh(['api', '--paginate', '--slurp', path]);
  if (!raw) return null;
  try {
    const pages = JSON.parse(raw);
    return Array.isArray(pages) ? pages.flat() : null;
  } catch {
    return null;
  }
}

function contractAtHead() {
  return readTaskContractAtRef(headRef(), { branch })?.contract ?? null;
}

/** Der Vertragsteil im CI-State-Kommentar; keine zweite Vertragsdatei. */
function contractView(contract) {
  if (!contract) return null;
  return {
    taskId: contract.taskId,
    phase: contract.phase,
    revision: contract.revision,
    taskType: contract.taskType ?? 'single',
    holdMerge: contract.holdMerge === true,
    status: contract.status ?? 'READY_FOR_MERGE',
    nextAction: contract.nextAction ?? '',
  };
}

function failedGatesOfRun() {
  if (!RUN_ID.test(String(ciRunId))) return [];
  const raw = gh(['api', `repos/${repo}/actions/runs/${ciRunId}/jobs?per_page=100`]);
  if (!raw) return [];
  try {
    const jobs = JSON.parse(raw)?.jobs ?? [];
    return jobs
      .filter((job) => ['failure', 'cancelled', 'timed_out'].includes(job.conclusion))
      .map((job) => job.name)
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

/** BLOCKED-Issues, die nach der gemeinsamen Scope-Regel diese Lane treffen.
 * Rueckgabe `null` heisst: Liste nicht lesbar, Blockerlage unbekannt. */
function blockedIssues() {
  return blockedIssuesFrom(
    listAll(`repos/${repo}/issues?state=open&per_page=100`),
    { branch },
  );
}

/** Ein Plan-Artefakt aus dem CI-Lauf; fehlt es, wird nicht gemergt. */
function readPlanArtifact() {
  const file = join(planDir, 'ci-plan.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Genau ein CI-State-Kommentar: den neuesten marker-tragenden Kommentar
 * aktualisieren, aeltere marker-tragende entfernen. Fremde Kommentare bleiben.
 */
function writeCiState({ number, state, conclusion: result, contract = null, nextAction = '' }) {
  if (!number || !hasToken || !RUN_ID.test(String(ciRunId)) || !FULL_SHA.test(headSha) || !FULL_SHA.test(baseSha)) return;
  let body;
  try {
    body = serializeCiState(buildCiState({
      runId: ciRunId,
      runAttempt,
      headSha,
      baseSha,
      state,
      conclusion: result,
      failedGates: failedGatesOfRun(),
      contract: contractView(contract),
      nextAction,
    }));
  } catch (error) {
    warn(`CI-State nicht gebaut: ${String(error?.message ?? error)}`);
    return;
  }
  const comments = listAll(`repos/${repo}/issues/${number}/comments?per_page=100`);
  if (!comments) {
    warn(`PR #${number}: Kommentare nicht lesbar; CI-State nicht geschrieben`);
    return;
  }
  const marked = comments.filter((comment) => parseCiState(comment.body));
  const newest = marked.at(-1);
  const written = newest
    ? gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${newest.id}`, '-f', `body=${body}`])
    : gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`]);
  if (written === null) warn(`PR #${number}: CI-State nicht geschrieben`);
  for (const older of marked.slice(0, -1)) {
    gh(['api', '--method', 'DELETE', `repos/${repo}/issues/comments/${older.id}`]);
  }
}

/** Labels spiegeln den Vertrag; ein Hold entfernt `task:ready`. */
function syncTaskLabels(number, contract, hold = false) {
  if (!number || !contract) return;
  const info = prInfo(number);
  const current = (info?.labels ?? []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
  const desired = promotionLabels(contract, hold);
  const diff = labelDiff(current, desired);
  for (const label of desired) {
    gh(['label', 'create', label, '--color', '1d76db', '--description', 'Task-Vertrag', '--force']);
  }
  for (const label of diff.remove) gh(['pr', 'edit', String(number), '--remove-label', label]);
  for (const label of diff.add) gh(['pr', 'edit', String(number), '--add-label', label]);
}

function newerRuns() {
  if (!RUN_ID.test(String(ciRunId)) || !FULL_SHA.test(headSha)) return [];
  const raw = gh([
    'api',
    `repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&head_sha=${headSha}&per_page=20`,
  ]);
  if (!raw) return [];
  try {
    return (JSON.parse(raw)?.workflow_runs ?? []).filter((entry) => entry.name === 'CI Verify');
  } catch {
    return [];
  }
}

/** Hold: Kommentar und Labels, kein Merge. */
function holdPromotion(number, contract, reason) {
  writeCiState({
    number,
    state: 'HOLD',
    conclusion,
    contract,
    nextAction: `Hold: ${reason}`,
  });
  syncTaskLabels(number, contract, true);
  warn(`PR #${number}: Hold - ${reason}; kein Merge`);
  return false;
}

/**
 * Der Branch-Kopf ist Daten, kein Code. Der Workflow hat Schreibrechte und
 * checkt deshalb nur `main` aus; der PR-Kopf kommt als Ref dazu, damit Titel
 * und Merge-Text aus seinen Commits stammen. Ausgefuehrt wird er nie - sonst
 * koennte ein fremder Branch die Promotion mit einem Schreibtoken veraendern.
 */
let contentRef = 'HEAD';
function fetchHead() {
  if (!branch || branch === MAIN) return;
  // Zuerst den exakt geprueften Commit holen, nicht den aktuellen Branch-Kopf:
  // zwischen CI-Lauf und Promote kann ein weiterer Push liegen.
  if (FULL_SHA.test(headSha)) {
    if (git(['fetch', 'origin', `+${headSha}:refs/rbd/promote-head`]) !== null) {
      contentRef = 'refs/rbd/promote-head';
      return;
    }
    warn(`geprueften Kopf ${headSha} nicht abrufbar; kein Merge auf Verdacht`);
  }
  if (git(['fetch', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]) === null) {
    warn(`Kopf ${branch} nicht abrufbar; PR-Text bleibt beim lokalen Stand`);
    return;
  }
  contentRef = `origin/${branch}`;
}

/** Der Ref, aus dem PR-Titel und Merge-Text stammen; `HEAD` ist der Notausgang. */
const headRef = () => contentRef;
/** True, wenn der geladene Ref wirklich der gepruefte Commit ist. */
const exactHead = () => FULL_SHA.test(headSha) && git(['rev-parse', '--verify', 'refs/rbd/promote-head']) === headSha;

const subject = (ref) => git(['log', '-1', '--pretty=%s', ref]) ?? `Promotion ${ref}`;
/** Gemeinsame Basis mit main; null heisst: der Diff ist nicht bestimmbar. */
function diffBase(ref) {
  for (const candidate of ['origin/main', 'main', 'HEAD']) {
    const base = git(['merge-base', candidate, ref]);
    if (base) return base;
  }
  return null;
}

/** Alle Commits des PR, nicht nur der letzte. */
function commitText(ref) {
  const base = diffBase(ref);
  return base ? git(['log', '--pretty=format:%s%n%b', `${base}..${ref}`]) ?? '' : '';
}

/**
 * Merge-Text: vorhandener PR-Body plus abgegrenzter Automationsbereich.
 *
 * Der menschliche Text bleibt unveraendert; ergaenzt werden nur fehlende
 * Pflichtsektionen und die Fakten des vollstaendigen Diffs. Ein Merge-Text aus
 * dem letzten Commit-Body hat genau diese Details vorher weggeworfen.
 */
function mergeText(existing, ref) {
  const base = diffBase(ref);
  if (!base) return { ok: false, body: '', changed: false, reason: 'keine gemeinsame Basis mit main; Diff nicht bestimmbar' };
  const entries = parseNameStatus(git(['diff', '--name-status', `${base}...${ref}`]) ?? '');
  return mergeAutomation(
    existing,
    describeAutomation({
      entries,
      outside: splitAutomation(existing).outside,
      commitText: commitText(ref),
      base,
      head: git(['rev-parse', ref]) ?? '',
    }),
  );
}

/** Body in eine temporaere Datei schreiben; `gh` liest nur Dateien, keine Argumente. */
function writeBodyFile(text, name = 'pr-body.md') {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-promote-'));
  const file = join(dir, name);
  writeFileSync(file, `${text}\n`);
  return file;
}

function prInfo(number) {
  if (!number) return null;
  const raw = gh(['pr', 'view', String(number), '--json', 'state,isCrossRepository,headRefOid,baseRefOid,baseRefName,headRepository,labels,url']);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * `gh pr list --head` filtert nur nach Branch-Namen und kennt keinen Owner.
 * Ein Fork mit gleichem Branch-Namen darf deshalb nie als eigener PR gelten.
 * `--base main` verhindert ausserdem, dass ein PR nach `integration` als
 * Promotions-PR fuer `main` wiederverwendet wird.
 */
function openPr(head = branch) {
  if (!head) return '';
  const raw = gh(promotionPrListArgs(head, MAIN));
  if (!raw || !/^\d+$/.test(raw)) return '';
  return prInfo(raw)?.isCrossRepository === false ? raw : '';
}

/** Check-Runs des geprueften Kopfes; `null` heisst nicht lesbar. */
function checkRunsOfHead() {
  if (!FULL_SHA.test(headSha)) return null;
  const raw = gh(['api', `repos/${repo}/commits/${headSha}/check-runs?per_page=100`, '--jq', '.check_runs']);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** PR-Status gegen den geprueften Commit und die eigene Herkunft pruefen. */
function verifiedPr(number) {
  const info = prInfo(number);
  const check = verifyPromotion({
    event,
    repo,
    headRepo: process.env.HEAD_REPO ?? '',
    branch,
    headSha,
    baseSha,
    ciRunId,
    checkRuns: checkRunsOfHead(),
    pr: info,
  });
  if (!check.ok) {
    warn(`PR #${number}: ${check.reason}; kein Merge`);
    return null;
  }
  if (!exactHead()) {
    warn(`PR #${number}: ${headSha} ist nicht als exakter Kopf geladen; kein Merge`);
    return null;
  }
  return info;
}

/**
 * Jeder Feature-Push haelt den PR-Body aktuell, ohne einen gepflegten Body zu
 * ueberschreiben: nur wenn eine Pflichtsektion fehlt, wird der Body aus dem
 * Commit gehoben. Das funktioniert auch bei ungueltiger Commit-Nachricht, weil
 * `body()` die Pflichtstruktur selbst baut.
 */
function syncPrBody(number) {
  if (!number) return;
  const current = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
  if (current === null) {
    warn(`PR #${number}: Body nicht lesbar; keine Schreiboperation`);
    return;
  }
  const merged = mergeText(current, headRef());
  if (!merged.ok) {
    warn(`PR #${number}: ${merged.reason}; Body bleibt unveraendert`);
    return;
  }
  if (!merged.changed) return;
  const bodyFile = writeBodyFile(merged.body);
  if (gh(['pr', 'edit', number, '--body-file', bodyFile]) === null) warn(`PR #${number}: Body nicht aktualisiert`);
  else log(`PR #${number}: Diff-Fakten im Automationsbereich ergaenzt`);
}

function label(number, name, note) {
  if (!number) return;
  gh(['label', 'create', name, '--color', 'd93f0b', '--description', note]);
  gh(['pr', 'edit', number, '--add-label', name]);
}

function ensurePr() {
  const existing = openPr();
  if (existing) return existing;
  const ref = headRef();
  const merged = mergeText('', ref);
  if (!merged.ok) {
    warn(`PR nicht angelegt: ${merged.reason}`);
    return '';
  }
  const bodyFile = writeBodyFile(merged.body);
  const headSpec = owner ? `${owner}:${branch}` : branch;
  if (gh(['pr', 'create', '--base', MAIN, '--head', headSpec, '--title', subject(ref), '--body-file', bodyFile]) === null) return '';
  return openPr();
}

/**
 * Gruen: erst Plan-Artefakt, Vertrag, Scope und Basis pruefen, dann mit dem
 * erhaltenen PR-Body mergen. Kein Auto-Merge, kein `update-branch` vor einem
 * Merge: der gepruefte Kopf bleibt die Identitaet.
 */
function mergeGreen(number) {
  const info = verifiedPr(number);
  if (!info) return holdPromotion(number, null, 'PR-Status nicht verifiziert');
  const ref = headRef();
  const contractRef = readTaskContractAtRef(ref, { branch });
  const contract = contractRef?.contract ?? null;
  if (contractRef) {
    const contractCheck = validateTaskContract(contract, { branch });
    if (!contractCheck.ok) {
      return holdPromotion(number, contract, `Task-Vertrag ungueltig: ${contractCheck.violations.join('; ')}`);
    }
    if (blockerFindings(contract).length > 0) {
      return holdPromotion(number, contract, `${blockerFindings(contract).length} offene Blocker im Task-Vertrag`);
    }
  } else {
    warn(`PR #${number}: kein Task-Vertrag am Kopf; Legacy-Merge mit Warnung`);
  }

  const plan = readPlanArtifact();
  const planCheck = validatePlanArtifact(plan, { headSha, baseSha });
  if (!planCheck.ok) return holdPromotion(number, contract, planCheck.reason);

  const mainNow = git(['rev-parse', 'origin/main']) ?? '';
  const stale = staleBase(baseSha, mainNow);
  if (stale) {
    // Der alte Kopf bleibt ungemergt; `update-branch` erzeugt einen neuen Kopf,
    // den die CI erneut pruefen muss.
    gh(['pr', 'update-branch', String(number)]);
    return holdPromotion(number, contract, `${stale}; Branch wird aktualisiert, der neue Lauf entscheidet.`);
  }

  const blocked = blockedIssues();
  if (blocked === null) {
    return holdPromotion(number, contract, 'BLOCKED-Status unbekannt: Issue-Liste nicht lesbar (fail-closed)');
  }
  if (blocked.length > 0) {
    return holdPromotion(
      number,
      contract,
      `BLOCKED-Issue im Scope: ${blocked.map((issue) => `#${issue.number}`).join(', ')}`,
    );
  }

  const contractHold = contractHoldReason(contract);
  if (contractHold) return holdPromotion(number, contract, contractHold);

  const current = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
  if (current === null) return holdPromotion(number, contract, 'PR-Body nicht lesbar');
  const composed = mergeText(current, ref);
  if (!composed.ok) return holdPromotion(number, contract, composed.reason);
  const bodyFile = writeBodyFile(composed.body, 'body.md');

  const merged =
    gh(['pr', 'merge', number, '--squash', '--match-head-commit', headSha, '--subject', subject(ref), '--body-file', bodyFile]) !== null;
  if (!merged) return holdPromotion(number, contract, 'GitHub hat den Merge auf dem exakten Kopf abgelehnt');

  writeCiState({
    number,
    state: 'SUCCESS',
    conclusion: 'success',
    contract,
    nextAction: 'Gemergt; Nachsorge starten.',
  });
  if (contract) syncTaskLabels(number, { ...contract, phase: 'AFTERCARE', taskType: 'aftercare' }, false);
  if (!elevated) {
    if (gh(['workflow', 'run', 'Auto Version & Release', '--ref', MAIN]) !== null) log('Release-Lauf ohne eigenes Token angestossen');
    else warn('Merge ohne PROMOTE_TOKEN; Release-Lauf nicht angestossen');
  }
  return true;
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
function integrate(name) {
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
  // Kein Reset auf den Remote-Stand: er wuerde fremde Aenderungen verwerfen.
  warn(`${name}: Rueckstand nicht erzwungen; Integrationsbranch bleibt unveraendert`);

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

fetchHead();
log(`Lauf aus vertrauenswuerdigem ${MAIN}${headSha ? `; Kopf ${headSha}` : ''}${branch ? ` (${branch})` : ''}`);

if (!event) {
  // Ein manueller Dispatch bringt keinen CI-Nachweis mit. Er zeigt nur an
  // oder oeffnet den ausdruecklichen Notausgang; `success` wird nie gesetzt.
  const action = manualDispatchAction(mode);
  if (action === 'integrate') {
    log('manuell: Notausgang integration angefordert');
    promoteRed();
  } else {
    const number = process.env.PR_NUMBER ?? openPr();
    const info = number ? prInfo(number) : null;
    log(
      info
        ? `manuell: PR #${number} ${info.state}, Kopf ${String(info.headRefOid ?? '').slice(0, 7)}, Basis ${info.baseRefName}; kein Merge ohne gruenen PR-Lauf`
        : 'manuell: keine Aktion (inspect); Merge nur aus einem gruenen PR-Lauf',
    );
  }
} else if (event === 'push' && branch && branch !== MAIN) {
  // Jeder Feature-Push oeffnet oder aktualisiert den PR. Frueher endete der Lauf
  // hier nach einer Logzeile; der PR entstand erst spaeter, und ohne PR lief das
  // leichte Gate statt der vollen PR-Pruefung.
  const number = ensurePr();
  if (number) {
    syncPrBody(number);
    log(`Feature-Push ${branch}: PR #${number} bereit; die vollen Gates laufen im PR-Lauf`);
  } else {
    warn(`Feature-Push ${branch}: kein PR angelegt; der naechste Lauf prueft erneut`);
  }
} else if (!branch || branch === MAIN) {
  log('main wird nicht promotet');
} else if (conclusion === 'success') {
  if (event === 'push' && branch !== MAIN) {
    // Gruener Feature-Push: PR anlegen, nicht mergen. Der PR-Lauf ist das volle
    // Gate; erst danach entscheidet der naechste Promote-Lauf ueber den Merge.
    const number = ensurePr();
    if (number) log(`PR #${number} fuer ${branch} angelegt; das volle Gate laeuft im PR`);
    else warn(`kein PR fuer ${branch}; Promote im PR-Lauf pruefen`);
  } else {
    const number = ensurePr();
    if (!number) warn(`kein PR fuer ${branch}; Merge uebersprungen`);
    else if (!mergeGreen(number)) warn(`PR #${number} nicht gemergt (PR-Status nicht verifiziert)`);
  }
} else if (REMOTE_CONCLUSIONS.has(conclusion)) {
  const number = openPr();
  if (number) {
    const contract = contractAtHead();
    const superseded = conclusion === 'cancelled'
      && isSupersededRun({ id: ciRunId, head_sha: headSha }, newerRuns());
    const state = superseded ? 'SUPERSEDED' : 'REMOTE_CI';
    writeCiState({
      number,
      state,
      conclusion,
      contract,
      nextAction: superseded
        ? 'Ein neuerer CI-Lauf ist die Autoritaet; diesen Zustand nicht als Merge-Beleg verwenden.'
        : 'REMOTE_CI: CI erneut starten; kein BLOCKED, kein Dump auf integration.',
    });
    syncTaskLabels(number, contract, true);
    if (!superseded) {
      label(number, 'ci/remote', 'Timeout oder Abbruch: CI erneut starten (REMOTE_CI)');
      gh(['pr', 'comment', number, '--body', `Der Lauf endete mit \`${conclusion}\`. Das ist REMOTE_CI (ERR-4014/ERR-4016): CI erneut starten. Kein \`BLOCKED\`, kein Dump auf \`${INTEGRATION}\`.`]);
    }
    log(superseded ? 'SUPERSEDED: neuerer Lauf ist die Autoritaet.' : `REMOTE_CI: ${conclusion} - kein roter Stand, kein Integrations-Dump`);
  } else {
    log(`REMOTE_CI: ${conclusion} - kein PR, kein Integrations-Dump`);
  }
} else if (conclusion === 'failure') {
  const number = openPr();
  if (number) {
    const contract = contractAtHead();
    writeCiState({
      number,
      state: 'FAILURE',
      conclusion,
      contract,
      nextAction: 'Befund beheben, turn:finish erneut ausfuehren; der naechste PR-Lauf entscheidet.',
    });
    syncTaskLabels(number, contract, true);
    label(number, RED_LABEL, 'Roter Stand: Issue und Label, Integration nur auf Anforderung');
  }
  if (integrateRequested) {
    promoteRed();
  } else {
    log('rot: Issue und Label gesetzt; `integration` nur auf Anforderung (Dispatch mit integrate=true)');
  }
} else {
  log(`Ergebnis ${conclusion || 'unbekannt'}: nichts zu tun`);
}
