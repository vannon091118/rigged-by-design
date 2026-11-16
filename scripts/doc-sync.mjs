#!/usr/bin/env node
/** Ergänzt den stabilen Doku-Marker nur, wenn er fehlt; `--check` prueft nur. */
import { execFileSync } from 'node:child_process';
import { verifyDocs, DOC_SET, syncDocs } from './lib/doc-sync.mjs';
import { ROOT } from './lib/report.mjs';
import { captureConsole } from './lib/compact.mjs';

const args = process.argv.slice(2);
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
const longRunning = args.includes('--serve') || args.includes('--watch');
captureConsole({ label: 'doc-sync', enabled: !longRunning });

if (args.includes('--check')) {
  const problems = verifyDocs();
  if (problems.length > 0) {
    for (const problem of problems) console.error(`docs: ${problem}`);
    process.exit(1);
  }
  console.log(`docs: PASS (${DOC_SET.length} Pflichtdokumente, stabile Marker)`);
  process.exit(0);
}

const changed = syncDocs();
if (args.includes('--staged') && changed.length > 0) {
  execFileSync('git', ['add', ...changed], { cwd: ROOT });
}
console.log(`docs: ${changed.length} fehlende(n) Marker ergaenzt (stabil, ohne Version/Zeitstempel)`);
