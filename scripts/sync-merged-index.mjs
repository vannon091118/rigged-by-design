#!/usr/bin/env node
/**
 * Schreibt `.lane-claims/merged-index.json` aus der lokalen Merge-Historie.
 * `--check` liest nur und endet bei Abweichung mit Exit 1.
 */
import { syncMergedIndex } from './lib/merged-index.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const unknown = args.filter((arg) => arg !== '--check');

if (unknown.length > 0) {
  console.error('[ERR-4019] merged-index: Nutzung: sync-merged-index.mjs [--check]');
  process.exit(2);
}

const result = syncMergedIndex({ check });
if (result.changed && check) {
  console.error('[ERR-4028] .lane-claims/merged-index.json ist nicht aktuell; mit --write neu erzeugen.');
  process.exit(1);
}
console.log(
  `[merged-index] ${result.index.entries.length} Merge-Belege ${result.changed ? 'geschrieben' : 'aktuell'}: ${result.path}`,
);
