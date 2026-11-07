#!/usr/bin/env node
/**
 * Druckt die Eskalationsstufe zu einem Befund. Ohne Argument liest er die
 * letzte Gate-Zusammenfassung aus `.verify-cache/reports`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describePlan, LEVELS, plan } from './lib/escalation.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const fileAt = args.indexOf('--file');
const fileArg = fileAt >= 0 ? args[fileAt + 1] : null;
const textArg = args.find((arg) => !arg.startsWith('--') && arg !== fileArg);

function latestSummary() {
  const base = join(ROOT, '.verify-cache', 'reports');
  if (!existsSync(base)) return '';
  const runs = readdirSync(base)
    .map((name) => join(base, name))
    .filter((dir) => statSync(dir).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const summary = runs[0] ? join(runs[0], 'summary.md') : '';
  return summary && existsSync(summary) ? readFileSync(summary, 'utf8') : '';
}

const text = fileArg ? readFileSync(fileArg, 'utf8') : textArg ?? latestSummary();
if (!text.trim()) {
  console.log(`Eskalation STRUCTURE: kein Befund gefunden. Leiter: ${LEVELS.join(' -> ')}`);
  process.exit(0);
}
const entry = plan(text);
console.log(describePlan(entry));
console.log(`  Art: ${entry.kind}`);
console.log(`  Befund: ${entry.reason}`);
