#!/usr/bin/env node
/** Steam-Developer-Notes-Gate: deutsche Pflichtsektionen, keine Fremd-Trailer. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fail } from './lib/report.mjs';

const FORBIDDEN = /Co-authored-by:|Generated with|\bFreebuff\b|\bCodebuff\b|\bClaude\b|\bAnthropic\b|\bOpenAI\b|\bCursor\b|Signed-off-by:|\[(?:Codebuff|Freebuff)\]/i;
const SECTIONS = [
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
];
const args = process.argv.slice(2);
function readInput() {
  if (args.includes('--head')) return execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' });
  if (args.includes('--pr')) return process.env.PR_BODY ?? '';
  const file = args.find((arg) => !arg.startsWith('--'));
  return file ? readFileSync(file, 'utf8') : '';
}
const text = readInput();
// Ein leerer PR-Body bestand das Gate bisher ohne einen einzigen Fehlschlag.
if (args.includes('--pr') && !text.trim()) {
  fail(1, 'ERR-4006', 'verify-commit-msg', 'PR-Body fehlt; Pflichtsektionen nicht pruefbar');
  process.exit(1);
}

let index = 0;
let failures = 0;
const report = (code, message) => {
  index += 1;
  fail(index, code, 'verify-commit-msg', message);
  failures += 1;
};

const trailer = FORBIDDEN.exec(text);
if (trailer) report('ERR-4005', `verbotener Drittanbieter-Trailer: ${trailer[0]}`);

if (!args.includes('--pr')) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (!lines[0] || lines[0].length < 8) report('ERR-4006', 'deutscher Update-Titel fehlt');
  let previous = -1;
  for (const section of SECTIONS) {
    const at = lines.indexOf(section);
    if (at < 0) { report('ERR-4006', `Pflichtsektion fehlt: ${section}`); continue; }
    if (at < previous) report('ERR-4006', `Sektion in falscher Reihenfolge: ${section}`);
    previous = at;
    const next = lines.findIndex((line, position) => position > at && line.startsWith('### '));
    const body = lines.slice(at + 1, next < 0 ? undefined : next).filter((line) => line.startsWith('- '));
    if (body.length === 0 || body.every((line) => line.length < 8)) report('ERR-4006', `Sektion ohne echten Inhalt: ${section}`);
  }
}

if (failures > 0) process.exit(1);
console.log(args.includes('--pr') ? 'verify-commit-msg: PR-Body PASS' : 'verify-commit-msg: PASS');
