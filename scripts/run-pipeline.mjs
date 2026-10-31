#!/usr/bin/env node
/**
 * Fail-Closed-Pipeline in zwei getrennten Modi.
 *
 * verify  liest ausschliesslich. Kein Gate schreibt; Autofix laeuft hier nie,
 *         damit ein Pruefer nicht vorher die Akte umschreibt.
 * fix     repariert alles Automatische (`--fix`) und protokolliert danach
 *         jede Aenderung und jede Loeschung im Arbeitsbaum.
 *
 * Drei Profile: quick (Entwicklungsfeedback), full (Integration), release.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';
import { executeStep, runGates } from './lib/gate-runner.mjs';
import { resetTreeKey } from './lib/gate-cache.mjs';
import { GATES, isFixMode, isProfile, planGates, PROFILES } from './lib/pipeline-plan.mjs';
import { describeChanges, diffTree } from './lib/tree-changes.mjs';
import { releaseOwner, sweepOrphans } from './lib/process-sweep.mjs';
import { installStopHandlers } from './lib/pipeline-stop.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'full';
if (!isProfile(PROFILE)) {
  fail(1, 'ERR-4006', 'pipeline', `unbekanntes Profil ${PROFILE}; erlaubt sind ${PROFILES.join(', ')}`);
  process.exit(1);
}
const FIX = isFixMode(argv);
// `verify:all` ist und bleibt das volle Profil; die kurzen Namen gelten nur fuer die neuen Profile.
const LABEL = PROFILE === 'full' ? 'verify:all' : `verify:${PROFILE}`;
const MODE = FIX ? 'fix' : 'verify';

/**
 * npm audit ist das einzige Gate, das ausserhalb des Repos rot werden kann: es braucht die
 * Registry. Deshalb laeuft es lokal nur bei einer Dependency-Aenderung, in CI und im
 * Release-Profil dagegen immer -- ueber RBD_VERIFY_AUDIT=1.
 */
function depsChanged() {
  const names = ['package.json', 'package-lock.json'];
  const probes = [
    ['diff', '--name-only', 'HEAD'],
    ['diff', '--name-only', 'HEAD~1', 'HEAD'],
    ['diff', '--name-only', 'origin/main...HEAD'],
  ];
  for (const probe of probes) {
    let out;
    try {
      out = execFileSync('git', [...probe, '--', ...names], { cwd: ROOT, encoding: 'utf8' });
    } catch {
      return true; // Unklarheit heisst: Pruefung laeuft.
    }
    if (out.trim()) return true;
  }
  return false;
}

function readTreeStatus() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return '';
  }
}

/**
 * Autofix ist der einzige schreibende Schritt. Er laeuft ausschliesslich hinter
 * `--fix` und nennt am Ende jede Datei, die er angefasst oder geloescht hat.
 */
async function runAutofix() {
  const before = readTreeStatus();
  console.log(`=== ERR-0911 Autofix (Profil ${PROFILE}) ===`);
  const result = await executeStep({ name: 'autofix', command: 'node', script: 'scripts/autofix-0911.mjs' });
  if (result.output.trim()) process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
  const changes = diffTree(before, readTreeStatus());
  const entries = describeChanges(changes);
  if (entries.length === 0) {
    console.log('autofix: keine Aenderung, Arbeitsbaum unveraendert (idempotent)');
  } else {
    console.log(`autofix: ${entries.length} Aenderung(en) im Arbeitsbaum`);
    for (const entry of entries) console.log(`  ${entry}`);
  }
  resetTreeKey();
  return result.status === 0 ? 0 : 1;
}

installStopHandlers();
sweepOrphans((message) => console.log(`${LABEL}: ${message}`));
console.log(
  FIX
    ? `=== fix (Profil ${PROFILE}) === Autofix schreibt, danach pruefen die Gates denselben Baum`
    : `=== ${LABEL} === rein lesend, kein Gate schreibt Dateien`,
);

let failed = 0;
if (FIX) failed += await runAutofix();
else if (process.env.RBD_VERIFY_FIX === '1') {
  fail(1, 'ERR-4006', 'pipeline', 'RBD_VERIFY_FIX ist abgeschafft; Reparaturen laufen ueber npm run fix');
  process.exit(1);
}

const selected = (planGates(PROFILE) ?? []).map((key) => {
  const step = { ...GATES[key] };
  if (step.name === 'tests' && PROFILE === 'quick') step.env = { RBD_TEST_PROFILE: 'quick' };
  if (step.name === 'build') step.ready = () => existsSync(join(ROOT, 'dist', 'index.html'));
  return step;
});
if (PROFILE !== 'quick' && process.env.RBD_VERIFY_AUDIT !== '1' && !depsChanged()) {
  const at = selected.findIndex((step) => step.name === 'audit');
  if (at >= 0) {
    selected.splice(at, 1);
    console.log('[skipped] audit: keine Dependency-Aenderung (in CI und release via RBD_VERIFY_AUDIT=1 erzwungen)');
  }
}

const gateFailures = await runGates(selected);
releaseOwner();
const total = failed + gateFailures.length;
if (total > 0) {
  console.error(`${LABEL}: ${total} Gate(s) rot`);
  process.exit(1);
}
console.log(`${LABEL}: PASS (alle Gates gruen, ${MODE}-Modus)`);
process.exit(0);
