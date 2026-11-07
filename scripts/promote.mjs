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
import {
  describeAutomation,
  mergeAutomation,
  parseNameStatus,
  splitAutomation,
} from './lib/body-sync.mjs';
import { verifyPromotion } from './lib/promote-guard.mjs';

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
  const raw = gh(['pr', 'view', String(number), '--json', 'state,isCrossRepository,headRefOid,baseRefName,headRepository']);
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
  const raw = gh(['pr', 'list', '--base', MAIN, '--head', head, '--state', 'open', '--json', 'number', '--jq', '.[0].number']);
  if (!raw || !/^\d+$/.test(raw)) return '';
  return prInfo(raw)?.isCrossRepository === false ? raw : '';
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
 * Gruen: mit dem erhaltenen PR-Body mergen, damit `verify-commit-msg --head`
 * gruen bleibt und die Beschreibung nicht auf den letzten Commit schrumpft.
 */
function mergeGreen(number) {
  const info = verifiedPr(number);
  if (!info) return false;
  const ref = headRef();
  const current = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
  if (current === null) {
    warn(`PR #${number}: Body nicht lesbar; kein Merge mit geratenem Text`);
    return false;
  }
  const composed = mergeText(current, ref);
  if (!composed.ok) {
    warn(`PR #${number}: ${composed.reason}; kein Merge`);
    return false;
  }
  const bodyFile = writeBodyFile(composed.body, 'body.md');
  if (process.env.RBD_PROMOTE_AUTO_MERGE === '1') {
    // GitHub mergt selbst: der Commit ist signiert (Verified). Das setzt im
    // Repo die Squash-Vorgabe "PR-Titel und -Beschreibung" voraus, sonst fehlt
    // main die Pflichtstruktur - deshalb nur mit ausdruecklichem Opt-in.
    if (gh(['pr', 'merge', number, '--squash', '--auto', '--match-head-commit', headSha]) !== null) {
      log(`PR #${number} fuer den Merge vorgemerkt (Auto-Merge, Kopf ${headSha.slice(0, 7)})`);
      return true;
    }
    warn(`Auto-Merge fuer #${number} nicht verfuegbar; expliziter Merge`);
  }
  // Kein `update-branch` vor dem Merge: es wuerde den geprueften Kopf
  // verschieben. Ist der Branch hinter main, verweigert GitHub den Merge und
  // der naechste CI-Lauf prueft den neuen Kopf.
  const merged =
    gh(['pr', 'merge', number, '--squash', '--match-head-commit', headSha, '--subject', subject(ref), '--body-file', bodyFile]) !== null;
  if (merged && !elevated) {
    if (gh(['workflow', 'run', 'Auto Version & Release', '--ref', MAIN]) !== null) log('Release-Lauf ohne eigenes Token angestossen');
    else warn('Merge ohne PROMOTE_TOKEN; Release-Lauf nicht angestossen');
  }
  return merged;
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

fetchHead();
log(`Lauf aus vertrauenswuerdigem ${MAIN}${headSha ? `; Kopf ${headSha}` : ''}${branch ? ` (${branch})` : ''}`);

if (!event) {
  // Ein manueller Dispatch bringt keinen CI-Nachweis mit. Er zeigt nur an
  // oder oeffnet den ausdruecklichen Notausgang; `success` wird nie gesetzt.
  if (mode === 'integrate') {
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
    else if (!mergeGreen(number)) warn(`PR #${number} nicht gemergt (Pflichtstatus noch nicht gruen?)`);
  }
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
