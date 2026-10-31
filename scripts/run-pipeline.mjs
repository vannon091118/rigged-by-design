#!/usr/bin/env node
/** Fail-Closed-Pipeline: Autofix zuerst (schreibt Dateien), danach alle unabhaengigen Gates parallel. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { line, ROOT } from './lib/report.mjs';
import { executeStep, runGates } from './lib/gate-runner.mjs';
import { isCached, markCached, resetTreeKey, treeKey } from './lib/gate-cache.mjs';
import { releaseOwner, sweepOrphans } from './lib/process-sweep.mjs';
import { installStopHandlers } from './lib/pipeline-stop.mjs';

// Autofix ist zugleich das Lint- und Dependency-Gate: der zweite Durchlauf
// derselben Pruefungen entfaellt. Bleibt ein Rest, ist das Autofix rot.
const steps = [
  { name: 'check:loc', command: 'npm', script: 'check:loc', code: 'ERR-4012', cache: true },
  { name: 'typecheck', command: 'npm', script: 'typecheck', code: 'ERR-1005', cache: true },
  { name: 'test-quality', command: 'node', script: 'scripts/verify-test-quality.mjs', code: 'ERR-4002', cache: true },
  { name: 'dead-code', command: 'node', script: 'scripts/verify-dead-code.mjs', code: 'ERR-4003', cache: true },
  { name: 'audit', command: 'npm', script: 'audit:gate', code: 'ERR-4004' },
  { name: 'tests', command: 'npm', script: 'test:ci', code: 'ERR-2001', cache: true },
  {
    name: 'build',
    command: 'npm',
    script: 'build',
    code: 'ERR-1005',
    cache: true,
    ready: () => existsSync(join(ROOT, 'dist', 'index.html')),
  },
];

installStopHandlers();
sweepOrphans((message) => console.log(`verify:all: ${message}`));

console.log('=== ERR-0911 Autofix ===');
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

const gateFailures = await runGates(steps);
releaseOwner();
const total = failed + gateFailures.length;
if (total > 0) {
  console.error(`verify:all: ${total} Gate(s) rot`);
  process.exit(1);
}
console.log('verify:all: PASS (alle Gates gruen)');
process.exit(0);
