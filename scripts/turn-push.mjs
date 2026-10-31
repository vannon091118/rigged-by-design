#!/usr/bin/env node
/** Turn-Abschluss: alles stagen, verify:all, deutscher Steam-Notes-Commit, Push nach main. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { bumpPatch } from './version-bump.mjs';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitRun = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const npmRun = (args) =>
  spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
const TARGET_BRANCH = 'main';
const MAX_PUSH_VERSUCHE = 3;

// Quick ist der Normalfall: die meisten Turns brauchen Build und RTP-Nachweise nicht.
// Voll laeuft ueber `npm run turn:finish:full`; CI prueft jeden Push ohnehin vollstaendig.
const args = process.argv.slice(2);
const profileArg = args.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'quick';
if (!['quick', 'full'].includes(PROFILE)) {
  fail(1, 'ERR-4006', 'turn:finish', `unbekanntes Profil ${PROFILE}; erlaubt sind quick und full`);
  process.exit(1);
}
const VERIFY_SCRIPT = PROFILE === 'full' ? 'verify:all' : 'verify:quick';
const paths = args.filter((value) => !value.startsWith('--'));
console.log(`turn:finish: Profil ${PROFILE} (${VERIFY_SCRIPT})`);

// Im verengten Modus muessen die Versionsdateien mit, sonst bliebe der Bump ungestaged.
const stage = () => {
  if (paths.length > 0) git(['add', '--', ...paths, 'package.json', 'package-lock.json']);
  else git(['add', '-A']);
};

// Erst pruefen, ob ueberhaupt etwas ansteht: ein Bump ohne Aenderung erzeugte leere Versions-Commits.
const schmutz = git(['status', '--porcelain', ...(paths.length > 0 ? ['--', ...paths] : [])]);
const offenVorab = Number(git(['rev-list', '--count', `origin/${TARGET_BRANCH}..HEAD`]));
if (!schmutz && offenVorab === 0) {
  console.log('turn:finish: keine Aenderungen zu committen');
  process.exit(0);
}
// Die Version gehoert in den Commit, nicht in einen Nachlauf: so bleibt main nach dem Push stehen.
// Ein zweiter Lauf nach rotem Gate darf nicht erneut bumpen, sonst springt die Version pro Versuch.
if (schmutz) {
  let headVersion = '';
  try {
    headVersion = JSON.parse(git(['show', 'HEAD:package.json'])).version ?? '';
  } catch {
    // Ohne package.json im HEAD wird gebumpt.
  }
  const treeVersion = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
  console.log(treeVersion === headVersion
    ? `turn:finish: Version ${bumpPatch()} gebumpt`
    : `turn:finish: Version ${treeVersion} bereits gebumpt (HEAD ${headVersion})`);
}

const verify = npmRun(['run', VERIFY_SCRIPT]);
if (verify.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', `${VERIFY_SCRIPT} ist rot; kein Commit und kein Push`);
  process.exit(1);
}
stage();
const staged = git(['diff', '--cached', '--name-only']);
// Ein früherer Lauf kann einen Commit erzeugt haben, der den Push nicht mehr geschafft hat.
// Ohne diesen Zweig würde der nächste Lauf "keine Aenderungen" melden und den Commit
// stillschweigend liegen lassen.
const offen = Number(git(['rev-list', '--count', `origin/${TARGET_BRANCH}..HEAD`]));
if (!staged) {
  if (offen === 0) {
    console.log('turn:finish: keine Aenderungen zu committen');
    process.exit(0);
  }
  console.log(`turn:finish: ${offen} Commit(s) warten noch auf den Push; kein neuer Commit noetig`);
}

const files = staged.split(/\r?\n/).filter(Boolean);
console.log(`turn:finish: ${files.length} Datei(en) gestaged`);
const notesPath = resolve(ROOT, '.turn-notes.md');
let message;
if (existsSync(notesPath)) {
  message = readFileSync(notesPath, 'utf8').trim();
} else {
  const shown = files.slice(0, 8).map((file) => `- ${file} aktualisiert.`).join('\n');
  const more = files.length > 8 ? `\n- Weitere ${files.length - 8} Dateien im selben Turn.` : '';
  message = [
    `Turn: ${files.length} Dateien aktualisiert`,
    '',
    '### Changes (Was ist neu)',
    shown + more,
    '',
    '### Technische Basis & Kausalität',
    '- Alle Änderungen laufen über den einen Store-, Ledger- und Snapshot-Vertrag; die Governance-Gates prüfen jede Stufe vor dem Commit.',
    '',
    '### Ausblick (Nächste Schritte)',
    '- Offene Spielsysteme und UI-Pfade nach den dokumentierten Prioritäten weiterführen.',
  ].join('\n');
}

const gitDir = git(['rev-parse', '--git-dir']);
const messageFile = resolve(ROOT, gitDir, 'TURN_COMMIT_MSG');
writeFileSync(messageFile, `${message}\n`);
spawnSync(process.execPath, ['scripts/sanitize-commit.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
const gate = spawnSync(process.execPath, ['scripts/verify-commit-msg.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
if (gate.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', 'Commit-Nachricht besteht das Notes-Gate nicht');
  process.exit(1);
}

// Zwei Commits mit demselben Titel sind fast immer eine liegengebliebene Notes-Datei.
const titel = (readFileSync(messageFile, 'utf8').split('\n', 1)[0] ?? '').trim();
if (titel && titel === git(['log', '-1', '--pretty=%s'])) {
  fail(1, 'ERR-4006', 'turn:finish', `Titel "${titel}" ist identisch mit HEAD; neue .turn-notes.md schreiben`);
  process.exit(1);
}

git(['commit', '-F', messageFile]);
// Verbraucht: sonst traegt die naechste Runde denselben Text wieder ein.
if (existsSync(notesPath)) {
  rmSync(notesPath, { force: true });
  console.log('turn:finish: .turn-notes.md verbraucht');
}
console.log(`turn:finish: Commit ${git(['rev-parse', '--short', 'HEAD'])} erstellt`);

/**
 * Remote-Rueckstand zaehlen, oder null wenn der Remote nicht erreichbar ist.
 *
 * Seit die Version im Turn gebumpt wird, bewegt der Release-Workflow `main` nicht mehr.
 * Das Nachziehen bleibt als Netz fuer den Fall, dass jemand anders auf main pusht.
 */
const rueckstand = () => {
  if (gitRun(['fetch', 'origin']).status !== 0) return null;
  try {
    return Number(git(['rev-list', '--count', `HEAD..origin/${TARGET_BRANCH}`]));
  } catch {
    return null;
  }
};

/** Lokal auf den Remote aufsetzen; bei Dreck im Arbeitsbaum stasht rebase selbst. */
const neuAufsetzen = (anzahl) => {
  console.log(`turn:finish: origin/${TARGET_BRANCH} ist um ${anzahl} Commit(s) voraus; ich setze lokal neu auf`);
  const dreckig = git(['status', '--porcelain']);
  const args = ['rebase', ...(dreckig ? ['--autostash'] : []), `origin/${TARGET_BRANCH}`];
  if (gitRun(args).status === 0) return true;
  gitRun(['rebase', '--abort']);
  return false;
};

/**
 * Pushen mit Nachziehen: Erst wenn der Remote aktuell ist, geprueft wurde und der Push
 * trotzdem abgelehnt wird, handelt es sich um Branch-Schutz und nicht um Rebase-Rueckstand.
 */
let branchSchutz = false;
let grund = `Push auf ${TARGET_BRANCH} nicht moeglich`;
for (let versuch = 1; versuch <= MAX_PUSH_VERSUCHE; versuch += 1) {
  const rueck = rueckstand();
  if (rueck === null) {
    grund = `kein Zugriff auf origin/${TARGET_BRANCH}`;
    break;
  }
  if (rueck > 0) {
    if (!neuAufsetzen(rueck)) {
      grund = `Merge-Konflikt beim Nachziehen von origin/${TARGET_BRANCH}`;
      break;
    }
    // Der neu aufgesetzte Baum enthaelt Remote-Arbeit und wurde noch nie geprueft.
    if (npmRun(['run', VERIFY_SCRIPT]).status !== 0) {
      fail(1, 'ERR-4006', 'turn:finish', `${VERIFY_SCRIPT} nach dem Nachziehen ist rot; kein Push, der Commit bleibt lokal`);
      process.exit(1);
    }
    stage();
    if (git(['diff', '--cached', '--name-only'])) {
      git(['commit', '--amend', '--no-edit']);
      console.log(`turn:finish: nach dem Nachziehen amendiert: ${git(['rev-parse', '--short', 'HEAD'])}`);
    }
    continue;
  }
  if (gitRun(['push', 'origin', `HEAD:${TARGET_BRANCH}`]).status === 0) {
    console.log(`turn:finish: PASS, ${TARGET_BRANCH} gepusht`);
    process.exit(0);
  }
  const erneut = rueckstand();
  if (erneut !== null && erneut > 0) {
    console.log(`turn:finish: origin/${TARGET_BRANCH} lief waehrend des Pushes weiter; neuer Versuch`);
    continue;
  }
  branchSchutz = true;
  break;
}

if (!branchSchutz) {
  fail(1, 'ERR-4008', 'turn:finish', `${grund}; der Commit bleibt lokal liegen`);
  process.exit(1);
}
const pushBranch = gitRun(['push', '-u', 'origin', 'HEAD']);
if (pushBranch.status !== 0) {
  fail(1, 'ERR-4008', 'turn:finish', `Push auf ${TARGET_BRANCH} und auf den Arbeitsbranch fehlgeschlagen`);
  process.exit(1);
}
fail(1, 'ERR-4008', 'turn:finish', `Direkter Push auf ${TARGET_BRANCH} abgelehnt; Branch gepusht. Fokussierter PR gegen ${TARGET_BRANCH} noetig`);
process.exit(1);
