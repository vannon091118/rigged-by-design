#!/usr/bin/env node
/** Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar. */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const HOOKS = ['.githooks/pre-commit', '.githooks/commit-msg'];

for (const hook of HOOKS) {
  if (!existsSync(join(ROOT, hook))) {
    fail(1, 'ERR-4018', 'hooks:install', `${hook} fehlt`);
    process.exit(1);
  }
}
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT });
  for (const hook of HOOKS) chmodSync(join(ROOT, hook), 0o755);
} catch (error) {
  fail(1, 'ERR-4018', 'hooks:install', error instanceof Error ? error.message : 'git config fehlgeschlagen');
  process.exit(1);
}
console.log(`hooks:install: core.hooksPath=.githooks, ${HOOKS.length} Hooks aktiv`);
