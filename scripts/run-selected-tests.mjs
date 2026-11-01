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
const result = spawnSync(
  process.execPath,
  [vitest, 'run', '--config', 'src/Config/vite.config.ts', ...files],
  { cwd: ROOT, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
