#!/usr/bin/env node
/**
 * Schneller Entwicklungsfeedback-Lauf: nur Tests, die vom aktuellen Diff
 * beruehrt werden, und nur die schnellen Beweisklassen.
 *
 * Statistik- und Messlaeufe (RTP, Poker-Verteilung, Soak, Benchmarks) sind
 * keine lokale Schleife: sie laufen in GitHub Actions (`npm run ci:long`).
 * `--include-long` nimmt sie bewusst wieder mit.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { changedFiles, selectAffectedTests } from './lib/affected-tests.mjs';
import { ROOT } from './lib/report.mjs';
import { partitionByProof, proofClassOf } from './lib/test-catalog.mjs';

const argv = process.argv.slice(2);
const includeLong = argv.includes('--include-long');
const selection = selectAffectedTests(changedFiles());
if (selection.reason) console.log(`affected: ${selection.reason}`);

const split = partitionByProof(selection.tests);
const long = split.long;
const tests = includeLong ? selection.tests : split.fast;

if (tests.length === 0 && long.length === 0) {
  console.log('affected: keine Testdateien betroffen');
  process.exit(0);
}
console.log(`affected: ${tests.length} Testdatei(en)${selection.runAll ? ' (alle)' : ''}`);
for (const test of tests) console.log(`  ${test}`);
if (long.length > 0) {
  console.log(`affected: ${long.length} lange Nachweis(e) an CI delegiert (npm run ci:long)`);
  for (const test of long) console.log(`  ${test} [${proofClassOf(test)}]`);
}
if (argv.includes('--list')) process.exit(0);
if (tests.length === 0) {
  console.log('affected: lokal nichts zu rechnen; die betroffenen Nachweise laufen in CI');
  process.exit(0);
}

const vitest = resolve(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', ...tests], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
