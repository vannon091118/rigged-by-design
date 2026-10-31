#!/usr/bin/env node
/**
 * Lokale Wegwerf-Branches nach dem Merge aufraeumen.
 *
 * Der Workflow `.github/workflows/pr-cleanup.yml` loescht den Remote-Zweig nach
 * dem Merge; lokal bleibt er sonst liegen. Dieses Skript loescht nur, was
 * gemergt ist, kein Upstream mehr hat und nicht `main` oder der aktuelle Branch
 * ist. `--dry-run` zeigt die Kandidaten ohne zu loeschen.
 */
import { execFileSync } from 'node:child_process';
import { fail, ROOT } from './lib/report.mjs';
import { parseBranches, prunable } from './lib/branch-prune.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const dryRun = process.argv.includes('--dry-run');

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
    console.log(`branches: wuerde loeschen ${name} (--dry-run)`);
    continue;
  }
  // `-D` ist hier sicher: die Liste enthaelt ausschliesslich nach main gemergte Zweige.
  execFileSync('git', ['branch', '-D', name], { cwd: ROOT, stdio: 'inherit' });
}
console.log(`branches: ${targets.length} Wegwerf-Branch(es)${dryRun ? ' gefunden' : ' geloescht'}`);
