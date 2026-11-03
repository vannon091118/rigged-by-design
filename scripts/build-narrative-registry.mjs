#!/usr/bin/env node
/**
 * Build the NAR-09 registry from the validated contribution inbox.
 * Default is --check (read-only); --write is the only mode that changes files.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRegistryDocument, canonical, loadNarrativeSources } from './lib/narrative-content.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET = join(ROOT, 'content/narrative/registry/fragments.json');
const report = loadNarrativeSources(ROOT);

if (!report.ok) {
  for (const problem of report.issues) console.error(`[narrative-content] ${problem.path}: ${problem.message}`);
  process.exit(1);
}

const next = `${JSON.stringify(buildRegistryDocument(report.contributions), null, 2)}\n`;
const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : null;
if (process.argv.includes('--write')) {
  writeFileSync(TARGET, next);
  console.log(`[narrative-content] Registry geschrieben: ${report.contributions.length} Fragmente`);
} else if (current !== null && canonical(JSON.parse(current)) === canonical(JSON.parse(next))) {
  console.log(`[narrative-content] Registry aktuell: ${report.contributions.length} Fragmente`);
} else {
  console.error('[narrative-content] Registry ist nicht aktuell; mit --write neu erzeugen.');
  process.exit(1);
}
