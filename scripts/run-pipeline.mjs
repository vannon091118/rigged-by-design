#!/usr/bin/env node
/** Fail-Closed-Pipeline: Autofix vor den harten Gates, jeder Fehler indiziert. */
import { spawnSync } from 'node:child_process';
import { line, ROOT } from './lib/report.mjs';

// Autofix ist zugleich das Lint- und Dependency-Gate: der zweite Durchlauf
// derselben Pruefungen entfaellt. Bleibt ein Rest, ist das Autofix rot.
const steps = [
  ['check:loc', 'npm', ['run', 'check:loc'], 'ERR-4012'],
  ['typecheck', 'npm', ['run', 'typecheck'], 'ERR-1005'],
  ['test-quality', process.execPath, ['scripts/verify-test-quality.mjs'], 'ERR-4002'],
  ['dead-code', process.execPath, ['scripts/verify-dead-code.mjs'], 'ERR-4003'],
  ['audit', 'npm', ['run', 'audit:gate'], 'ERR-4004'],
  ['tests', 'npm', ['run', 'test:ci'], 'ERR-2001'],
  ['build', 'npm', ['run', 'build'], 'ERR-1005'],
];

let failed = 0;
let index = 0;

console.log('=== ERR-0911 Autofix ===');
const autofix = spawnSync(process.execPath, ['scripts/autofix-0911.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (autofix.status !== 0) {
  failed += 1;
  index += 1;
  console.error(line(index, 'ERR-0911', 'pipeline', 'Autofix konnte nicht vollstaendig laufen'));
}
for (const [name, command, args, code] of steps) {
  console.log(`=== Gate: ${name} ===`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: command === 'npm' && process.platform === 'win32' });
  if (result.status !== 0) {
    failed += 1;
    index += 1;
    console.error(line(index, code, `pipeline/${name}`, 'Gate fehlgeschlagen; Details oben'));
  }
}

if (failed > 0) {
  console.error(`verify:all: ${failed} Gate(s) rot`);
  process.exit(1);
}
console.log('verify:all: PASS (alle Gates gruen)');
process.exit(0);
