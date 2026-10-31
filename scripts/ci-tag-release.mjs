#!/usr/bin/env node
/**
 * Tag und Release fuer die Version, die im gepushten Commit steht.
 *
 * Der Workflow committet bewusst nichts mehr: die Version wird lokal im Turn gebumpt.
 * Damit bleibt `main` nach dem Push stehen und der naechste Turn braucht kein Rebase.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw new Error(`Ungueltige Version in package.json: ${String(pkg.version)}`);
}
const tag = `v${pkg.version}`;

let vorhanden = false;
try {
  git(['rev-parse', '--verify', `refs/tags/${tag}`]);
  vorhanden = true;
} catch {
  // Tag fehlt: dann wird er unten angelegt.
}

if (vorhanden) {
  console.log(`${tag} existiert bereits; kein neues Release, main bleibt unveraendert.`);
  process.exit(0);
}

git(['tag', '-a', tag, '-m', `Release ${tag}`]);
git(['push', 'origin', tag]);
execFileSync('gh', ['release', 'create', tag, '--generate-notes', '--title', tag], {
  cwd: ROOT, stdio: 'inherit',
});
console.log(`Release ${tag} erstellt; kein Commit, main bleibt unveraendert.`);
