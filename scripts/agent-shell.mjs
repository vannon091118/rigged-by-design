#!/usr/bin/env node
/**
 * `rbd shell watch`: startet eine interaktive Bash mit Guard-RC und einem
 * lokalen Watcher daneben. Der Watcher erbt das Terminal und eskaliert
 * Receipt-/Verstosswechsel; die Shell-Funktionen blockieren die Werkzeuge
 * vor der Ausfuehrung. Beim Shell-Exit wird der Watcher beendet.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';

const rc = join(ROOT, 'scripts', 'shell', 'guard.sh');
if (!existsSync(rc)) {
  console.error(`agent-shell: Guard-RC fehlt: ${rc}`);
  process.exit(1);
}

const env = { ...process.env, RBD_GUARD_ROOT: ROOT, RBD_SHELL: '1' };
const watcher = spawn(process.execPath, [join(ROOT, 'scripts', 'shell-watch.mjs')], {
  cwd: process.cwd(),
  stdio: ['ignore', 'inherit', 'inherit'],
  env,
});

const shell = spawn('bash', ['--rcfile', rc, '-i'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env,
});

const finish = (code = 0) => {
  if (!watcher.killed) watcher.kill('SIGTERM');
  process.exit(code);
};
shell.on('exit', (code) => finish(code ?? 0));
shell.on('error', (error) => {
  console.error(`agent-shell: Bash konnte nicht gestartet werden: ${error.message}`);
  finish(1);
});
process.on('SIGINT', () => shell.kill('SIGINT'));
process.on('SIGTERM', () => {
  shell.kill('SIGTERM');
  finish(0);
});
