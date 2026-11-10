#!/usr/bin/env node
/**
 * Governance-Freeze-Gate.
 *
 * Aufruf:
 *   node scripts/verify-governance-freeze.mjs                  # Lane-Diff gegen main
 *   node scripts/verify-governance-freeze.mjs --ci \
 *        --base=<sha> --head=<sha> [--github-output=<datei>]
 *
 * Beide Modi pruefen denselben Diff: die Merge-Basis zu `main` gegen Index
 * (lokal) bzw. gegen den Branch-Kopf (CI).
 *
 * Verhalten:
 * - Keine inhaltliche Governance-Aenderung -> PASS. Mechanische Marker
 *   (Doku-Marker, Versionszeile) zaehlen nicht.
 * - Inhaltliche Aenderung ohne gueltige Freigabe -> rot (`ERR-4030`). Fehlt die
 *   Freigabe ganz, meldet das Gate `Verdacht auf unautorisierte Korruption` und
 *   setzt `violation=corruption`; die CI legt darauf ein BLOCKED-Issue an. Der
 *   Branch bleibt bestehen.
 * - Exit 1 nur bei Verstoss; Exit 2 bei unlesbarem Diff (fail-closed).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { FREEZE, FREEZE_UNLOCK_FILE, governanceChanges, isMarkerLine, laneBase, verifyUnlockRecord } from './lib/governance-freeze.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => {
  const hit = argv.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  const next = index >= 0 ? argv[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const gitOrNull = (args) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

const ci = flag('ci');
const outputFile = arg('github-output');
const emit = (lines) => {
  if (!outputFile) return;
  appendFileSync(outputFile, `${lines.join('\n')}\n`);
};

const stop = (code, message, { violation = 'corruption' } = {}) => {
  console.error(message);
  emit([`violation=${violation}`, `error=${FREEZE.errorCode}`]);
  process.exit(code);
};

const head = ci ? arg('head') || 'HEAD' : 'HEAD';
const givenBase = ci ? arg('base') || process.env.BASE_REF || '' : '';

// Gemeldete Basis nur uebernehmen, wenn sie echt ist; sonst (und lokal immer)
// gilt die Merge-Basis zu `main`, damit beide Gates denselben Diff sehen.
const base = givenBase && !/^0+$/.test(givenBase) ? givenBase : laneBase(head);

if (ci && (!base || /^0+$/.test(base))) {
  stop(2, 'verify-governance-freeze: Basis nicht bestimmbar; ohne Diff keine Freigabe (fail-closed).', {
    violation: 'unknown-base',
  });
}

let files;
try {
  files = ci
    ? (gitOrNull(['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`]) ??
      git(['diff', '--name-only', '--diff-filter=ACMR', `${base}..${head}`]))
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', base || 'HEAD']);
} catch {
  stop(2, 'verify-governance-freeze: Diff nicht lesbar; ohne Diff keine Freigabe (fail-closed).', {
    violation: 'unknown-diff',
  });
}
const changed = String(files ?? '').split(/\r?\n/).filter(Boolean);
const guarded = governanceChanges(changed);

/** True, wenn eine Datei nur Marker- oder Versionszeilen aendert. */
function onlyMarkers(file) {
  const args = ci
    ? ['diff', '--unified=0', `${base}...${head}`, '--', file]
    : ['diff', '--cached', '--unified=0', base || 'HEAD', '--', file];
  let diff;
  try {
    diff = git(args);
  } catch {
    return false;
  }
  const lines = diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
  if (lines.length === 0) return true;
  return lines.every(isMarkerLine);
}

const substantive = guarded.filter((file) => !onlyMarkers(file));

if (substantive.length === 0) {
  console.log(
    guarded.length === 0
      ? 'verify-governance-freeze: keine Governance-Datei beruehrt; Freeze nicht betroffen.'
      : `verify-governance-freeze: ${guarded.length} Governance-Datei(en) nur mit Markern; Freeze nicht betroffen.`,
  );
  emit(['violation=none']);
  process.exit(0);
}

const unlockPath = `${ROOT}/${FREEZE_UNLOCK_FILE}`;
const record = existsSync(unlockPath) ? JSON.parse(readFileSync(unlockPath, 'utf8')) : null;
const verdict = verifyUnlockRecord(record, { base, paths: substantive });

if (verdict.ok) {
  console.log(`verify-governance-freeze: Freigabe erkannt fuer ${substantive.length} Governance-Datei(en) (Basis ${base.slice(0, 7)}).`);
  emit(['violation=none']);
  process.exit(0);
}

const reason = record ? verdict.why : 'keine Freigabe-Datei';
const hint = `Freeze aktiv seit ${FREEZE.since}; Meilenstein: ${FREEZE.milestone}.`;
console.error(`[${FREEZE.errorCode}] verify-governance-freeze: Governance-Freeze verletzt (${reason}).`);
for (const file of substantive) console.error(`  - ${file}`);
console.error(`  ${hint}`);
console.error('  Freigabe nur nach ausdruecklicher Anweisung: node scripts/freeze-unlock.mjs --pin=<pin>');
stop(record ? 1 : 1, record ? FREEZE.corruption : FREEZE.corruption, { violation: 'corruption' });
