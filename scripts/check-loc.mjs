#!/usr/bin/env node
/**
 * LOC-Guard fuer VaCoin Casino Roguelite.
 *
 * Jede Datei gehoert genau einer Zustaendigkeit und bekommt aus
 * scripts/loc-budgets.mjs ihr Budget. Die Hot Zone liegt bei 4/7 des Caps
 * (350 -> 200). Reisst eine Datei ihre Grenze, muss sie bis unter die Hot Zone
 * reduziert werden, nicht nur knapp unter die Grenze.
 *
 * Neue @loc-exception-Header sind verboten; nur die Legacy-Liste der Registry
 * darf noch eine 350er Grenze tragen, und diese Liste wird nur kuerzer.
 *
 * Exit-Code 1 bei Verstoessen, sonst 0.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './lib/report.mjs';
import { budgetFor, LEGACY_LOC } from './loc-budgets.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');
const EXCEPTION_TAG = '// @loc-exception:';

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) found.push(full);
  }
  return found;
}

function countLines(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

function hasExceptionHeader(text) {
  const firstLine = text.split('\n', 1)[0].trimStart();
  if (!firstLine.startsWith(EXCEPTION_TAG)) return false;
  return firstLine.slice(EXCEPTION_TAG.length).trim().length > 0;
}

if (!existsSync(SRC_DIR)) {
  console.error(`check:loc - Verzeichnis fehlt: ${relative(ROOT, SRC_DIR) || 'src'}`);
  process.exit(1);
}

const files = walk(SRC_DIR)
  .map((file) => {
    const text = readFileSync(file, 'utf8');
    const name = relative(ROOT, file).split(sep).join('/');
    const budget = budgetFor(name);
    const legacyBudget = LEGACY_LOC.get(name);
    const exception = hasExceptionHeader(text);
    const legacy = legacyBudget !== undefined;
    const limit = legacy && exception ? legacyBudget.cap : budget.cap;
    const hotZone = legacy && exception ? legacyBudget.hotZone : budget.hotZone;
    const lines = countLines(text);
    const unauthorized = exception && !legacy;
    const overLimit = lines > limit;
    const stale = legacy && exception && !overLimit && lines <= hotZone;
    const hot = !unauthorized && !overLimit && !stale && lines > hotZone;
    const role = legacy && exception ? 'legacy' : budget.id;
    return { name, lines, limit, hotZone, role, legacy, exception, unauthorized, overLimit, stale, hot };
  })
  .sort((a, b) => b.lines - a.lines);

const violations = files.filter((file) => file.unauthorized || file.overLimit || file.stale);
const hotFiles = files.filter((file) => file.hot);

console.log(`check:loc - ${files.length} Datei(en) unter src/ geprueft`);
for (const file of files) {
  const mark = violations.includes(file) ? 'FAIL' : file.hot ? 'HOT ' : ' ok ';
  const note = file.unauthorized
    ? ' (Ausnahme verboten)'
    : file.stale
      ? ' (Ausnahme ueberfluessig)'
      : ` [${file.role}]${file.hot ? ` Hot Zone ab ${file.hotZone}` : ''}`;
  console.log(`  ${mark} ${String(file.lines).padStart(4)}/${file.limit}${note}  ${file.name}`);
}

if (violations.length > 0) {
  violations.forEach((file, index) => {
    const reason = file.unauthorized
      ? `${file.lines} LOC: Explizite Ausnahmen sind verboten. Header entfernen und auf hoechstens ${file.hotZone} LOC reduzieren.`
      : file.stale
        ? `${file.lines} LOC: Ausnahme ist ueberfluessig. Header entfernen; die Datei liegt schon unter ${file.hotZone}.`
        : `${file.lines} LOC (Grenze ${file.limit}). Reduziere auf hoechstens ${file.hotZone} LOC, um die Hot Zone zu verlassen.`;
    fail(index + 1, 'ERR-4012', file.name, reason);
  });
  process.exit(1);
}

if (hotFiles.length > 0) {
  console.log(`\ncheck:loc - ${hotFiles.length} Datei(en) in der Hot Zone. Jede Aenderung muss sie unter ihre Hot Zone bringen.`);
}
console.log('\ncheck:loc - OK, alle Dateien innerhalb ihres Budgets');
