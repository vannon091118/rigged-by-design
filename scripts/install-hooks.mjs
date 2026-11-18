#!/usr/bin/env node
/**
 * Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar.
 *
 * `--check` prueft nur. Git ueberspringt einen nicht ausfuehrbaren Hook ohne
 * Fehler, und ohne `core.hooksPath` ruft es gar keinen auf — ein frischer Klon
 * committet dann still ohne Gate. Der Modus macht genau diese Luecke sichtbar;
 * `verify-contracts` liest den Zustand aus dieser einen Quelle.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';
import { DRIVER_NAME, driverCommand } from './merge-driver-generated.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'install-hooks' });

const HOOKS = ['.githooks/pre-commit', '.githooks/commit-msg', '.githooks/pre-push', '.githooks/post-merge'];
const CHECK_ONLY = process.argv.includes('--check');

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Auf Windows (NTFS) oder mit core.fileMode=false ist das ausfuehrbare Bit
 *  irrelevant; git fuehrt den Hook trotzdem aus, wenn der Index-Modus 100755
 *  ist. Die statSync-Pruefung wird dann ausgelassen. */
function isFileModeIrrelevant() {
  const fileMode = git(['config', '--get', 'core.fileMode']);
  if (fileMode === 'false') return true;
  const osType = process.platform;
  return osType === 'win32';
}

/** Index-Modus je Hook: git fuehrt nur 100755 aus. */
function indexModes() {
  const modes = new Map();
  for (const entry of git(['ls-files', '-s', '--', ...HOOKS]).split('\n')) {
    const match = /^(\d{6})\s+\S+\s+\d+\t(.+)$/.exec(entry.trim());
    if (match) modes.set(match[2], match[1]);
  }
  return modes;
}

/** Dateisysteme ohne exec-Bit (NTFS/FAT32 unter Linux/WSL2) liefern irrefuehrende statSync-Ergebnisse. */
function isFileModeIrrelevant() {
  return true;
}

/** Leer heisst: git ruft alle vier Hooks auf. */
function hookProblems() {
  const problems = [];
  const hooksPath = git(['config', '--get', 'core.hooksPath']);
  if (hooksPath !== '.githooks') {
    problems.push(`core.hooksPath ist '${hooksPath || 'nicht gesetzt'}' statt '.githooks'; git ruft keinen Hook auf.`);
  }
  const modes = indexModes();
  for (const hook of HOOKS) {
    if (!existsSync(join(ROOT, hook))) {
      problems.push(`${hook} fehlt im Arbeitsbaum.`);
      continue;
    }
    const mode = modes.get(hook);
    if (mode !== '100755') {
      problems.push(`${hook} hat im Index Modus ${mode ?? 'unbekannt'} statt 100755; git ueberspringt ihn still.`);
    }
    if (!isFileModeIrrelevant() && (statSync(join(ROOT, hook)).mode & 0o111) === 0) {
      problems.push(`${hook} ist auf der Platte nicht ausfuehrbar.`);
    }
  }
  return problems;
}

if (!existsSync(join(ROOT, '.git'))) {
  console.log(`hooks:${CHECK_ONLY ? 'check' : 'install'}: kein Git-Repository, Hooks uebersprungen`);
  process.exit(0);
}

if (CHECK_ONLY) {
  const problems = hookProblems();
  if (problems.length === 0) {
    console.log(`hooks:check: PASS (core.hooksPath=.githooks, ${HOOKS.length} Hooks 100755)`);
    process.exit(0);
  }
  problems.forEach((problem, index) => fail(index + 1, 'ERR-4018', 'hooks:check', problem));
  console.error('hooks:check: FAIL; `node scripts/install-hooks.mjs` armen (das macht auch `prepare` beim Install).');
  process.exit(1);
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT });
  for (const hook of HOOKS) chmodSync(join(ROOT, hook), 0o755);
  // Merge-Driver fuer generierte Artefakte (#877): repo-lokal, weil git diese
  // Konfiguration nicht aus der versionierten Datei liest. Ohne Eintrag bleibt
  // das Standardverhalten (Konflikt) bestehen.
  execFileSync('git', ['config', `merge.${DRIVER_NAME}.name`, 'generierte Artefakte aus Quellen regenerieren'], { cwd: ROOT });
  execFileSync('git', ['config', `merge.${DRIVER_NAME}.driver`, driverCommand()], { cwd: ROOT });
} catch (error) {
  fail(1, 'ERR-4018', 'hooks', error instanceof Error ? error.message : 'git config fehlgeschlagen');
  process.exit(1);
}
const remaining = hookProblems();
if (remaining.length > 0) {
  remaining.forEach((problem, index) => fail(index + 1, 'ERR-4018', 'hooks', problem));
  process.exit(1);
}
console.log(`hooks: armiert: core.hooksPath=.githooks, ${HOOKS.length} Hooks aktiv (100755), Merge-Driver ${DRIVER_NAME} registriert`);
