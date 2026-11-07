#!/usr/bin/env node
/**
 * Lokale Wegwerf-Branches nach dem Merge melden.
 *
 * Das Skript loescht nichts von selbst: der Standard ist `--dry-run`. Erst
 * `--apply` entfernt einen Branch, und zwar mit `git branch -d` - das verweigert
 * jeden Zweig, der nicht sicher nach `main` gemergt ist. `main`, `integration`
 * und der aktuelle Branch bleiben unberuehrt.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { fail, ROOT } from './lib/report.mjs';
import { parseBranches, prunable } from './lib/branch-prune.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dryRun = !apply || argv.includes('--dry-run');

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

let merged = new Set();
let refs = '';
try {
  merged = new Set(git(['branch', '--merged', 'main', '--format=%(refname:short)']).split(/\r?\n/).filter(Boolean));
  refs = git(['for-each-ref', '--format=%(refname:short)%09%(upstream:track)', 'refs/heads']);
} catch (error) {
  fail(1, 'ERR-4008', 'branches', `Git-Zustand nicht lesbar: ${String(error).slice(0, 120)}`);
  process.exit(1);
}

const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const candidates = parseBranches(refs).map((branch) => ({ ...branch, merged: merged.has(branch.name) }));
const targets = prunable(candidates, { current });

if (targets.length === 0) {
  console.log('branches: keine Wegwerf-Branches, nichts zu loeschen');
  process.exit(0);
}
for (const name of targets) {
  if (dryRun) {
    console.log(`branches: wuerde loeschen ${name} (dry-run; Loeschen mit --apply)`);
    continue;
  }
  // `-d` statt `-D`: git verweigert selbst dann, wenn der Zweig entgegen der
  // Kandidatenliste nicht sicher gemergt ist. Ein Refusal ist ein Befund, kein
  // Grund, hart zu loeschen.
  const result = spawnSync('git', ['branch', '-d', name], { cwd: ROOT, encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`branches: geloescht ${name}`);
    continue;
  }
  const reason = (result.stderr || result.stdout || '').trim().split(/\r?\n/)[0] ?? 'unbekannt';
  console.log(`branches: ${name} bleibt (git branch -d verweigert: ${reason})`);
}
console.log(`branches: ${targets.length} Wegwerf-Branch(es)${dryRun ? ' gefunden (dry-run)' : ' bearbeitet'}`);
