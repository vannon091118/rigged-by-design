#!/usr/bin/env node
/** Aktiviert die Repo-Hooks (core.hooksPath) und macht sie ausfuehrbar. */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';
import { DRIVER_NAME, driverCommand } from './merge-driver-generated.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'install-hooks' });

const HOOKS = ['.githooks/pre-commit', '.githooks/commit-msg', '.githooks/pre-push', '.githooks/post-merge'];

if (!existsSync(join(ROOT, '.git'))) {
  console.log('hooks:install: kein Git-Repository, Hooks uebersprungen');
  process.exit(0);
}

for (const hook of HOOKS) {
  if (!existsSync(join(ROOT, hook))) {
    fail(1, 'ERR-4018', 'hooks:install', `${hook} fehlt`);
    process.exit(1);
  }
}
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT });
  for (const hook of HOOKS) chmodSync(join(ROOT, hook), 0o755);
  // Merge-Driver fuer generierte Artefakte (#877): repo-lokal, weil git diese
  // Konfiguration nicht aus der versionierten Datei liest. Ohne Eintrag bleibt
  // das Standardverhalten (Konflikt) bestehen.
  execFileSync('git', ['config', `merge.${DRIVER_NAME}.name`, 'generierte Artefakte aus Quellen regenerieren'], { cwd: ROOT });
  execFileSync('git', ['config', `merge.${DRIVER_NAME}.driver`, driverCommand()], { cwd: ROOT });
} catch (error) {
  fail(1, 'ERR-4018', 'hooks:install', error instanceof Error ? error.message : 'git config fehlgeschlagen');
  process.exit(1);
}
console.log(`hooks:install: core.hooksPath=.githooks, ${HOOKS.length} Hooks aktiv, Merge-Driver ${DRIVER_NAME} registriert`);
