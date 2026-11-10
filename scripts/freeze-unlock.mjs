#!/usr/bin/env node
/**
 * Freigabe des Governance-Freeze.
 *
 * Aufruf:
 *   node scripts/freeze-unlock.mjs --pin=<pin> [--base=<sha>] [--json]
 *   RBD_FREEZE_PIN=<pin> node scripts/freeze-unlock.mjs
 *
 * Der PIN wird nur verglichen (scrypt) und nie gespeichert. Die Freigabe-Datei
 * `.lane-claims/freeze-unlock.json` enthaelt Basis, Pfadliste und einen Token;
 * CI kann sie ohne PIN pruefen. Basis ist die Merge-Basis zu `main`, also der
 * ganze Lane-Diff - nicht nur der letzte Commit.
 *
 * Ohne Freigabe bleibt der Freeze zu: der Pre-Commit-Hook laesst den Commit
 * nicht durch, und die CI meldet eine Governance-Aenderung ohne Freigabe als
 * BLOCKED-Issue (`Verdacht auf unautorisierte Korruption`). Der Branch bleibt
 * bestehen; es gibt keine Branch-Loeschung.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { FREEZE, FREEZE_UNLOCK_FILE, governanceChanges, isMarkerLine, laneBase, pinMatches, unlockRecord } from './lib/governance-freeze.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const hit = argv.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  const next = index >= 0 ? argv[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const pin = arg('pin') ?? process.env.RBD_FREEZE_PIN ?? '';
if (!pin) {
  console.error('freeze-unlock: PIN fehlt. Aufruf: node scripts/freeze-unlock.mjs --pin=<pin>');
  process.exit(1);
}
if (!pinMatches(pin)) {
  console.error(`freeze-unlock: PIN falsch. Der Freeze bleibt aktiv (${FREEZE.errorLevel ?? FREEZE.errorCode}).`);
  process.exit(1);
}

// Dieselbe Basis wie das Gate: die Merge-Basis zu `main`. Sonst deckt die
// Freigabe lokal einen anderen Diff als den, den CI prueft.
// Immer ein voller Commit: ein kurzer `--base`-Wert wuerde eine Freigabe
// schreiben, die die CI gegen die volle Basis nie erkennt.
const resolveBase = (value) => {
  const candidate = value || laneBase('HEAD');
  if (!candidate) return '';
  try {
    return git(['rev-parse', '--verify', `${candidate}^{commit}`]);
  } catch {
    return '';
  }
};
const base = resolveBase(arg('base'));
if (!base) {
  console.error('freeze-unlock: Basis nicht aufloesbar; eine Freigabe braucht einen vollen Commit.');
  process.exit(1);
}
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', base || 'HEAD'])
  .split(/\r?\n/)
  .filter(Boolean);
const onlyMarkers = (file) => {
  let diff;
  try {
    diff = git(['diff', '--cached', '--unified=0', base || 'HEAD', '--', file]);
  } catch {
    return false;
  }
  const lines = diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
  return lines.length === 0 || lines.every(isMarkerLine);
};
const paths = governanceChanges(staged).filter((file) => !onlyMarkers(file));

if (paths.length === 0) {
  console.error('freeze-unlock: keine inhaltliche Governance-Aenderung gestaged; keine Freigabe noetig.');
  process.exit(1);
}

const record = unlockRecord({ base, paths });
writeFileSync(`${ROOT}/${FREEZE_UNLOCK_FILE}`, `${JSON.stringify(record, null, 2)}\n`);
if (arg('json') !== undefined) {
  process.stdout.write(`${JSON.stringify(record)}\n`);
} else {
  console.log(`freeze-unlock: Freigabe geschrieben (Basis ${base.slice(0, 7)}, ${paths.length} Pfad(e)).`);
  console.log(`  Datei stagen: git add ${FREEZE_UNLOCK_FILE}`);
  console.log(`  Gilt nur fuer diese Basis. Meilenstein: ${FREEZE.milestone}.`);
}
