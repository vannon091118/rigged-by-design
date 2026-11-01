#!/usr/bin/env node
/** Schreibt Version und Zeitstempel in die Pflichtdoku; `--check` prueft nur. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyDocs, DOC_SET, syncDocs } from './lib/doc-sync.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 16)} UTC`;

if (args.includes('--check')) {
  const problems = verifyDocs();
  if (problems.length > 0) {
    for (const problem of problems) console.error(`docs: ${problem}`);
    process.exit(1);
  }
  console.log(`docs: PASS (${DOC_SET.length} Pflichtdokumente, v${version})`);
  process.exit(0);
}

const changed = syncDocs(version, stamp);
if (args.includes('--staged') && changed.length > 0) {
  execFileSync('git', ['add', ...changed], { cwd: ROOT });
}
console.log(`docs: ${changed.length} Marker auf v${version} | ${stamp} gesetzt`);
