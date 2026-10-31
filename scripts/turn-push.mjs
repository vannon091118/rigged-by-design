#!/usr/bin/env node
/** Turn-Abschluss: alles stagen, verify:all, deutscher Steam-Notes-Commit, Push nach main. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitRun = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const npmRun = (args) =>
  spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
const TARGET_BRANCH = 'main';
const MAX_PUSH_VERSUCHE = 3;

const verify = npmRun(['run', 'verify:all']);
if (verify.status !== 0) {
  fail(1, 'ERR-4006', 'turn:finish', 'verify:all ist rot; kein Commit und kein Push');
  process.exit(1);
}

const paths = process.argv.slice(2);
if (paths.length > 0) git(['add', '--', ...paths]);
else git(['add', '-A']);
const staged = git(['diff', '--cached', '--name-only']);
if (!staged) {
  console.log('turn:finish: keine Aenderungen zu committen');
  process.exit(0);
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

git(['commit', '-F', messageFile]);
console.log(`turn:finish: Commit ${git(['rev-parse', '--short', 'HEAD'])} erstellt`);

/**
 * Remote-Rueckstand zaehlen, oder null wenn der Remote nicht erreichbar ist.
 *
 * Der CI-Versionssprung (`chore(release): … [skip ci]`) laeuft nach jedem Push auf main und
 * zieht den Remote weiter, waehrend hier gearbeitet wird. Ohne dieses Nachziehen lehnt git den
 * Push mit "remote contains work that you do not have locally" ab.
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
    if (npmRun(['run', 'verify:all']).status !== 0) {
      fail(1, 'ERR-4006', 'turn:finish', 'verify:all nach dem Nachziehen ist rot; kein Push, der Commit bleibt lokal');
      process.exit(1);
    }
    if (paths.length > 0) git(['add', '--', ...paths]);
    else git(['add', '-A']);
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
