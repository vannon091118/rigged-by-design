#!/usr/bin/env node
/**
 * Testkommando der Gates: ohne Auswahl laeuft die Suite des Profils, mit
 * `RBD_TEST_FILES` genau die uebergebenen Dateien. Eine Auswahl ist
 * Entwicklungsfeedback und wird im Bericht nie als vollstaendig bezeichnet.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT } from './lib/report.mjs';

const files = (process.env.RBD_TEST_FILES ?? '')
  .split(',')
  .map((file) => file.trim())
  .filter(Boolean);
const vitest = resolve(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
if (!vitest) {
  console.error('run-selected-tests: vitest fehlt; pnpm install --frozen-lockfile ausfuehren');
  process.exit(1);
}
const requireTests = process.env.RBD_REQUIRE_TESTS === '1';
const result = spawnSync(
  process.execPath,
  [vitest, 'run', '--config', 'src/Config/vite.config.ts', ...files],
  { cwd: ROOT, encoding: 'utf8' },
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (requireTests && result.status === 0) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const skipped = /(?:^|\s)\d+\s+skipped\b/.test(output);
  const passed = /(\d+)\s+passed\b/.exec(output);
  if (skipped || !passed || Number(passed[1]) === 0) {
    console.error('run-selected-tests: Pflichtnachweis wurde uebersprungen oder hat keinen Test ausgefuehrt; das ist kein PASS');
    process.exit(1);
  }
}
process.exit(result.status ?? 1);
