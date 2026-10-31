#!/usr/bin/env node
/** Automatische ERR-0911-Kandidaten: Lint-Fix, Dependency-Matrix, Commit-Sanitizing. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { autofixLine, ROOT } from './lib/report.mjs';

let index = 0;
const log = (message) => {
  index += 1;
  console.log(autofixLine(index, 'autofix', message));
};

/** Nur der aktuelle Bildsatz bleibt: alte Versionsordner sind reiner PNG-Binaer-Ballast. */
function pruneScreenshots() {
  const root = resolve(ROOT, 'docs', 'screenshots');
  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^v\d+\./.test(entry.name)) continue;
      rmSync(join(root, entry.name), { recursive: true, force: true });
      log(`veralteter Screenshot-Ordner entfernt: docs/screenshots/${entry.name}`);
    }
  }
  const stray = resolve(ROOT, 'screenshots');
  if (existsSync(stray)) {
    rmSync(stray, { recursive: true, force: true });
    log('Wurzel-screenshots/ entfernt');
  }
}

pruneScreenshots();

/**
 * Lint-Cache: unveraenderte Dateien werden nicht erneut geparst. Der Cache liegt ausserhalb
 * von node_modules, weil npm ci jedes Mal node_modules neu aufbaut, und wird verworfen, sobald
 * sich ESLint-Config oder Lockfile geaendert haben -- dann gilt alles als unveraendert.
 */
const CACHE_DIR = resolve(ROOT, '.verify-cache');
const SCOPE_FILES = ['eslint.config.js', 'eslint.config.mjs', 'package-lock.json'];
function lintScope() {
  const hash = createHash('sha256');
  for (const file of SCOPE_FILES) {
    hash.update(`${file}\0`);
    try {
      hash.update(readFileSync(resolve(ROOT, file)));
    } catch {
      hash.update('fehlt');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}
mkdirSync(CACHE_DIR, { recursive: true });
const scopeFile = join(CACHE_DIR, 'eslint-scope.json');
const scope = lintScope();
if (existsSync(scopeFile) && readFileSync(scopeFile, 'utf8') !== scope) {
  rmSync(join(CACHE_DIR, 'eslint'), { recursive: true, force: true });
  rmSync(join(CACHE_DIR, 'eslint.json'), { force: true });
  log('Lint-Cache verworfen: ESLint-Config oder Lockfile geaendert');
}

const eslint = spawnSync(
  process.execPath,
  [
    'node_modules/eslint/bin/eslint.js',
    '.',
    '--fix',
    '--cache',
    '--cache-location',
    join(CACHE_DIR, 'eslint'),
    '--cache-strategy',
    'content',
  ],
  {
    cwd: ROOT,
    encoding: 'utf8',
  },
);
writeFileSync(scopeFile, scope);
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
