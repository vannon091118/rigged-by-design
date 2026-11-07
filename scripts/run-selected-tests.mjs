#!/usr/bin/env node
/**
 * Testkommando der Gates: ohne Auswahl laeuft die Suite des Profils, mit
 * `RBD_TEST_FILES` genau die uebergebenen Dateien. Eine Auswahl ist
 * Entwicklungsfeedback und wird im Bericht nie als vollstaendig bezeichnet.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { changedFiles, selectAffectedTests } from './lib/affected-tests.mjs';
import { LONG_PROOF_CLASSES, partitionByProof, proofClassOf, testFiles } from './lib/test-catalog.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const proofArg = argv.find((arg) => arg.startsWith('--proof='))?.slice('--proof='.length);
const affectedLong = argv.includes('--affected-long');
const explicitFiles = (process.env.RBD_TEST_FILES ?? '')
  .split(',')
  .map((file) => file.trim())
  .filter(Boolean);
const testFilesOnly = testFiles().filter((file) => /\.test\.tsx?$/.test(file));
let files = explicitFiles;

if (proofArg) {
  const wanted = new Set(proofArg.split(',').map((value) => value.trim()).filter(Boolean));
  files = testFilesOnly.filter((file) => wanted.has(proofClassOf(file)));
} else if (affectedLong) {
  const selection = selectAffectedTests(changedFiles());
  files = partitionByProof(selection.tests).long.filter((file) => /\.test\.tsx?$/.test(file));
} else if (files.length === 0 && process.env.RBD_TEST_PROFILE === 'quick') {
  files = testFilesOnly.filter((file) => !LONG_PROOF_CLASSES.includes(proofClassOf(file)));
}

if (affectedLong && files.length === 0) {
  console.log('run-selected-tests: kein langer Nachweis vom Diff betroffen');
  process.exit(0);
}
if (proofArg && files.length === 0) {
  console.log(`run-selected-tests: keine Testdateien fuer Beweisklasse(n) ${proofArg}`);
  process.exit(0);
}

const vitest = resolve(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
if (!existsSync(vitest)) {
  console.error('run-selected-tests: vitest fehlt; pnpm install --frozen-lockfile ausfuehren');
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [vitest, 'run', '--config', 'src/Config/vite.config.ts', ...files],
  { cwd: ROOT, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
