#!/usr/bin/env node
/** Schneller Entwicklungsfeedback-Lauf: nur Tests, die vom aktuellen Diff beruehrt werden. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { changedFiles, selectAffectedTests } from './lib/affected-tests.mjs';
import { ROOT } from './lib/report.mjs';

const selection = selectAffectedTests(changedFiles());
if (selection.reason) console.log(`affected: ${selection.reason}`);
if (selection.tests.length === 0) {
  console.log('affected: keine Testdateien betroffen');
  process.exit(0);
}
console.log(`affected: ${selection.tests.length} Testdatei(en)${selection.runAll ? ' (alle)' : ''}`);
for (const test of selection.tests) console.log(`  ${test}`);
if (process.argv.includes('--list')) process.exit(0);

const vitest = resolve(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', ...selection.tests], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
