#!/usr/bin/env node
/** Automatische ERR-0911-Kandidaten: Lint-Fix, Dependency-Matrix, Commit-Sanitizing. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { autofixLine, ROOT } from './lib/report.mjs';

let index = 0;
const log = (message) => {
  index += 1;
  console.log(autofixLine(index, 'autofix', message));
};

const eslint = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '.', '--fix'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (eslint.status === 0) log('ESLint --fix ohne Restfehler');
else {
  log('ESLint --fix ausgefuehrt; unfixbare Reste sind ein rotes Gate');
  process.exitCode = 1;
}

const deps = spawnSync(process.execPath, ['scripts/sync-dependency-matrix.mjs'], { cwd: ROOT, encoding: 'utf8' });
process.stdout.write(deps.stdout ?? '');
if (deps.status !== 0) {
  process.stderr.write(deps.stderr ?? '');
  process.exitCode = 1;
}

const messageFile = resolve(ROOT, '.git', 'COMMIT_EDITMSG');
if (existsSync(messageFile)) {
  const sanitize = spawnSync(process.execPath, ['scripts/sanitize-commit.mjs', messageFile], { cwd: ROOT, encoding: 'utf8' });
  if (sanitize.status === 0) log('Commit-Nachricht auf verbotene Trailer geprueft');
}
