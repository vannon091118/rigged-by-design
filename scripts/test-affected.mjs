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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  // Eine Ausgabe ist keine Delegation: die Liste wird abgelegt und der Bericht
  // nennt den Nachweis als offen, bis `npm run ci:long` ihn erbracht hat.
  mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
  writeFileSync(
    join(ROOT, '.verify-cache', 'delegated.json'),
    `${JSON.stringify({ tests: long, proof: long.map(proofClassOf), dispatched: false }, null, 2)}\n`,
  );
  console.log(`affected: ${long.length} lange Nachweis(e) NICHT lokal ausgefuehrt - Nachweis offen`);
  for (const test of long) console.log(`  ${test} [${proofClassOf(test)}]`);
  console.log('affected: Delegation ausfuehren mit `npm run ci:long` (startet Actions und wartet auf das Ergebnis)');
}
if (argv.includes('--list')) process.exit(0);
if (tests.length === 0) {
  console.log('affected: lokal nichts zu rechnen; die langen Nachweise sind offen, nicht erbracht');
  process.exit(0);
}

const vitest = resolve(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', '--config', 'src/Config/vite.config.ts', ...tests], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
