#!/usr/bin/env node
/**
 * Promote: gruene Staende mergen, rote Staende auf die permanente
 * Integrationsbranch legen.
 *
 * Ein Lauf pro CI-Ergebnis. Die Wahrheit liegt im Branch und in Labels, nie in
 * der Warteschlange: GitHub haelt pro Concurrency-Gruppe nur einen wartenden
 * Lauf, ein einzelner Lauf arbeitet deshalb den ganzen Rueckstand ab. Zwei
 * parallele rote Staende werden komponiert (git merge), nie verworfen; ein
 * Textkonflikt wird gelabelt und bleibt beim Agenten.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IDENTITY } from './lib/identity.mjs';

const MAIN = 'main';
const INTEGRATION = 'integration';
const RED_LABEL = 'integration/rot';
const CONFLICT_LABEL = 'integration/konflikt';
const branch = process.env.HEAD_BRANCH ?? '';
const conclusion = process.env.CONCLUSION ?? '';
const hasToken = Boolean(process.env.GH_TOKEN);

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

/** Gruen: PR mit Commit-Text mergen, damit `verify-commit-msg --head` gruen bleibt. */
function mergeGreen(number) {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-promote-'));
  const bodyFile = join(dir, 'body.md');
  writeFileSync(bodyFile, `${body(`origin/${branch}`)}\n`);
  if (process.env.RBD_PROMOTE_AUTO_MERGE === '1') {
    // GitHub mergt selbst: der Commit ist signiert (Verified). Das setzt im
    // Repo die Squash-Vorgabe "PR-Titel und -Beschreibung" voraus, sonst fehlt
    // main die Pflichtstruktur - deshalb nur mit ausdruecklichem Opt-in.
    if (gh(['pr', 'merge', number, '--squash', '--auto']) !== null) {
      log(`PR #${number} fuer den Merge vorgemerkt (Auto-Merge)`);
      return true;
    }
    warn(`Auto-Merge fuer #${number} nicht verfuegbar; expliziter Merge`);
  }
  return gh(['pr', 'merge', number, '--squash', '--subject', subject(`origin/${branch}`), '--body-file', bodyFile]) !== null;
}

/** Alle offenen Staende, die als rot markiert sind - plus der aktuelle Lauf. */
function redBranches() {
  const raw = gh(['pr', 'list', '--label', RED_LABEL, '--state', 'open', '--json', 'headRefName', '--jq', '.[].headRefName']) ?? '';
  const fromLabel = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [...new Set([...fromLabel, branch])].filter((name) => name && name !== MAIN);
}

/** Rot: Stand auf die Integrationsbranch legen; ein Konflikt wird nicht erzwungen. */
function integrate(name) {
  const number = openPr(name);
  const merged = git(['merge', '--no-ff', `origin/${name}`, '-m', `Integration: ${subject(`origin/${name}`)}`]);
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
  integrate(name);
}

function promoteRed() {
  git(['fetch', 'origin', `+refs/heads/${MAIN}:refs/remotes/origin/${MAIN}`]);
  const exists = git(['rev-parse', '--verify', `refs/remotes/origin/${INTEGRATION}`]) !== null;
  if (exists) git(['fetch', 'origin', `+refs/heads/${INTEGRATION}:refs/remotes/origin/${INTEGRATION}`]);
  git(['checkout', '-B', INTEGRATION, `origin/${exists ? INTEGRATION : MAIN}`]);
  git(['config', 'user.name', IDENTITY.name]);
  git(['config', 'user.email', IDENTITY.email]);
  for (const name of redBranches()) {
    git(['fetch', 'origin', `+refs/heads/${name}:refs/remotes/origin/${name}`]);
    integrate(name);
  }
}

if (!branch || branch === MAIN) {
  log('main wird nicht promotet');
} else if (conclusion === 'success') {
  const number = ensurePr();
  if (!number) warn(`kein PR fuer ${branch}; Merge uebersprungen`);
  else if (!mergeGreen(number)) warn(`PR #${number} nicht gemergt (Pflichtstatus noch nicht gruen?)`);
} else if (['failure', 'timed_out', 'cancelled', 'startup_failure'].includes(conclusion)) {
  label(openPr(), RED_LABEL, 'Roter Stand, liegt auf der Integrationsbranch');
  promoteRed();
} else {
  log(`Ergebnis ${conclusion || 'unbekannt'}: nichts zu tun`);
}
