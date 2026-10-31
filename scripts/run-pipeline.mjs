#!/usr/bin/env node
/** Fail-Closed-Pipeline mit drei Profilen: quick (Entwicklungsfeedback), full (Integration), release (Freigabe). */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, line, ROOT } from './lib/report.mjs';
import { executeStep, runGates } from './lib/gate-runner.mjs';
import { isCached, markCached, resetTreeKey, treeKey } from './lib/gate-cache.mjs';
import { releaseOwner, sweepOrphans } from './lib/process-sweep.mjs';
import { installStopHandlers } from './lib/pipeline-stop.mjs';

const PROFILE = (() => {
  const arg = process.argv.find((value) => value.startsWith('--profile='));
  const name = arg ? arg.slice('--profile='.length) : 'full';
  if (!['quick', 'full', 'release'].includes(name)) {
    fail(1, 'ERR-4006', 'pipeline', `unbekanntes Profil ${name}; erlaubt sind quick, full, release`);
    process.exit(1);
  }
  return name;
})();
// `verify:all` ist und bleibt das volle Profil; die kurzen Namen gelten nur fuer die neuen Profile.
const LABEL = PROFILE === 'full' ? 'verify:all' : `verify:${PROFILE}`;

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

const all = {
  'check:loc': { name: 'check:loc', command: 'npm', script: 'check:loc', code: 'ERR-4012', cache: true },
  typecheck: { name: 'typecheck', command: 'npm', script: 'typecheck', code: 'ERR-1005', cache: true },
  'test-quality': {
    name: 'test-quality',
    command: 'node',
    script: 'scripts/verify-test-quality.mjs',
    code: 'ERR-4002',
    cache: true,
  },
  'dead-code': {
    name: 'dead-code',
    command: 'node',
    script: 'scripts/verify-dead-code.mjs',
    code: 'ERR-4003',
    cache: true,
  },
  audit: { name: 'audit', command: 'npm', script: 'audit:gate', code: 'ERR-4004' },
  tests: { name: 'tests', command: 'npm', script: 'test:ci', code: 'ERR-2001', cache: true },
  build: {
    name: 'build',
    command: 'npm',
    script: 'build',
    code: 'ERR-1005',
    cache: true,
    ready: () => existsSync(join(ROOT, 'dist', 'index.html')),
  },
};

// quick: alles ausser Build und Audit, dazu die schnellen Tests. RTP-, Balance- und
// Soak-Nachweise fehlen hier absichtlich -- sie bleiben an full und release gebunden.
const PROFILES = {
  quick: ['check:loc', 'typecheck', 'test-quality', 'dead-code', 'tests'],
  full: ['check:loc', 'typecheck', 'test-quality', 'dead-code', 'audit', 'tests', 'build'],
  release: ['check:loc', 'typecheck', 'test-quality', 'dead-code', 'audit', 'tests', 'build'],
};

const selected = PROFILES[PROFILE].map((key) => {
  const step = { ...all[key] };
  if (step.name === 'tests' && PROFILE === 'quick') step.env = { RBD_TEST_PROFILE: 'quick' };
  return step;
});
if (PROFILE !== 'quick' && process.env.RBD_VERIFY_AUDIT !== '1' && !depsChanged()) {
  const at = selected.findIndex((step) => step.name === 'audit');
  if (at >= 0) {
    selected.splice(at, 1);
    console.log('[skipped] audit: keine Dependency-Aenderung (in CI und release via RBD_VERIFY_AUDIT=1 erzwungen)');
  }
}

installStopHandlers();
sweepOrphans((message) => console.log(`${LABEL}: ${message}`));

console.log(`=== ERR-0911 Autofix (Profil ${PROFILE}) ===`);
const before = treeKey();
let failed = 0;
if (isCached('autofix', before)) {
  console.log(`[cached] autofix uebersprungen, Baum unveraendert (${before.slice(0, 8)})`);
} else {
  const autofix = await executeStep({ name: 'autofix', command: 'node', script: 'scripts/autofix-0911.mjs' });
  if (autofix.output.trim()) process.stdout.write(autofix.output.endsWith('\n') ? autofix.output : `${autofix.output}\n`);
  resetTreeKey();
  if (autofix.status !== 0) {
    failed += 1;
    console.error(line(1, 'ERR-0911', 'pipeline', 'Autofix konnte nicht vollstaendig laufen'));
  } else {
    markCached('autofix', treeKey());
  }
}

const gateFailures = await runGates(selected);
releaseOwner();
const total = failed + gateFailures.length;
if (total > 0) {
  console.error(`${LABEL}: ${total} Gate(s) rot`);
  process.exit(1);
}
console.log(`${LABEL}: PASS (alle Gates gruen)`);
process.exit(0);
