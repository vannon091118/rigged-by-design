#!/usr/bin/env node
/**
 * LOC-Guard fuer VaCoin Casino Roguelite.
 *
 * Jede Datei gehoert genau einer Zustaendigkeit und bekommt aus
 * scripts/loc-budgets.mjs ihr Budget. Die Hot Zone liegt bei 4/7 des Caps
 * (350 -> 200). Reisst eine Datei ihre Grenze, muss sie bis unter die Hot Zone
 * reduziert werden, nicht nur knapp unter die Grenze.
 *
 * Gezaehlt werden nur Code-Zeilen: Kommentare und Leerzeilen zaehlen nicht,
 * ebenso wenig reine Textdaten (`registry.generated.ts`) und Event-Templates
 * (`events/definitions/`). Das Budget gilt der Logik, nicht der Prosa.
 *
 * Neue @loc-exception-Header sind verboten; nur die Legacy-Liste der Registry
 * darf noch eine 350er Grenze tragen, und diese Liste wird nur kuerzer.
 *
 * Exit-Code 1 bei Verstoessen, sonst 0.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './lib/report.mjs';
import { budgetFor, LEGACY_LOC } from './loc-budgets.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');
const EXCEPTION_TAG = '// @loc-exception:';
/** Reine Textbausteine: Daten, keine Logik. */
const TEXT_DATA = new Set(['src/core/sim/narrative/composer/registry.generated.ts']);
/** Event-Templates beschreiben Szenen und Choices; das Budget gilt der Engine. */
const TEMPLATE_DIR = 'src/core/sim/narrative/events/definitions/';

function skipReason(name) {
  if (TEXT_DATA.has(name)) return 'Textbausteine';
  if (name.startsWith(TEMPLATE_DIR)) return 'Template';
  return null;
}

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

/**
 * Zaehlt Code-Zeilen ohne Kommentare und Leerzeilen. Der Scanner kennt
 * String-Literale inklusive Template-Strings, damit `//` in URLs nicht als
 * Kommentar gilt.
 */
function countCodeLines(text) {
  let count = 0;
  let inBlock = false;
  for (const raw of text.split('\n')) {
    let code = '';
    for (let index = 0; index < raw.length; index += 1) {
      const char = raw[index];
      const next = raw[index + 1];
      if (inBlock) {
        if (char === '*' && next === '/') { inBlock = false; index += 1; }
        continue;
      }
      if (char === '/' && next === '/') break;
      if (char === '/' && next === '*') { inBlock = true; index += 1; continue; }
      if (char === '"' || char === "'" || char === '`') {
        const quote = char;
        code += char;
        for (index += 1; index < raw.length; index += 1) {
          code += raw[index];
          if (raw[index] === '\\') {
            index += 1;
            if (index < raw.length) code += raw[index];
            continue;
          }
          if (raw[index] === quote) break;
        }
        continue;
      }
      code += char;
    }
    if (code.trim().length > 0) count += 1;
  }
  return count;
}

function hasExceptionHeader(text) {
  const firstLine = text.split('\n', 1)[0].trimStart();
  if (!firstLine.startsWith(EXCEPTION_TAG)) return false;
  return firstLine.slice(EXCEPTION_TAG.length).trim().length > 0;
}

/** Pfade, die dieser Lauf gegenüber der Basis geaendert hat. */
function changedPaths() {
  // Explizite Basis fuer lokale Vorpruefungen; sonst Merge-Basis zu main.
  let base = process.env.RBD_LOC_BASE || '';
  if (!base) {
    for (const ref of ['origin/main', 'HEAD^']) {
      try {
        base = execFileSync('git', ['merge-base', 'HEAD', ref], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (base) break;
      } catch {
        // Naechste Basis versuchen.
      }
    }
  }
  if (!base) return new Set();
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(output.split(/\r?\n/).filter(Boolean));
  } catch {
    return new Set();
  }
}

if (!existsSync(SRC_DIR)) {
  console.error(`check:loc - Verzeichnis fehlt: ${relative(ROOT, SRC_DIR) || 'src'}`);
  process.exit(1);
}

const skipped = [];
const changed = changedPaths();
const files = walk(SRC_DIR)
  .map((file) => {
    const text = readFileSync(file, 'utf8');
    const name = relative(ROOT, file).split(sep).join('/');
    const reason = skipReason(name);
    if (reason) {
      skipped.push({ name, reason });
      return null;
    }
    const budget = budgetFor(name);
    const legacyBudget = LEGACY_LOC.get(name);
    const exception = hasExceptionHeader(text);
    const legacy = legacyBudget !== undefined;
    const limit = legacy && exception ? legacyBudget.cap : budget.cap;
    const hotZone = legacy && exception ? legacyBudget.hotZone : budget.hotZone;
    const lines = countCodeLines(text);
    const unauthorized = exception && !legacy;
    const overLimit = lines > limit;
    const stale = legacy && exception && !overLimit && lines <= hotZone;
    const hot = !unauthorized && !overLimit && !stale && lines > hotZone;
    const hotChange = hot && changed.has(name);
    const role = legacy && exception ? 'legacy' : budget.id;
    return { name, lines, limit, hotZone, role, legacy, exception, unauthorized, overLimit, stale, hot, hotChange };
  })
  .filter((file) => file !== null)
  .sort((a, b) => b.lines - a.lines);

const violations = files.filter((file) => file.unauthorized || file.overLimit || file.stale || file.hotChange);
const hotFiles = files.filter((file) => file.hot);

console.log(`check:loc - ${files.length} Datei(en) unter src/ geprueft, ${skipped.length} ohne Logik-Budget`);
for (const file of skipped) console.log(`  skip ${file.name} (${file.reason})`);
for (const file of files) {
  const mark = violations.includes(file) ? 'FAIL' : file.hot ? 'HOT ' : ' ok ';
  const note = file.unauthorized
    ? ' (Ausnahme verboten)'
    : file.stale
      ? ' (Ausnahme ueberfluessig)'
      : ` [${file.role}]${file.hot ? ` Hot Zone ab ${file.hotZone}` : ''}${file.hotChange ? ' | geaendert: modularisieren oder ASK_USER' : ''}`;
  console.log(`  ${mark} ${String(file.lines).padStart(4)}/${file.limit}${note}  ${file.name}`);
}

if (violations.length > 0) {
  violations.forEach((file, index) => {
    const reason = file.unauthorized
      ? `${file.lines} LOC: Explizite Ausnahmen sind verboten. Header entfernen und auf hoechstens ${file.hotZone} LOC reduzieren.`
      : file.stale
        ? `${file.lines} LOC: Ausnahme ist ueberfluessig. Header entfernen; die Datei liegt schon unter ${file.hotZone}.`
        : file.hotChange
          ? `${file.lines} LOC: Hot Zone und in diesem Lauf geaendert. Modularisiere die Datei mit eigener Ownership und Pruefung. Wenn eine LOC-Erhoehung fachlich besser ist als die Extraktion, stelle ASK_USER mit Begruendung, warum die Erhoehung besser ist.`
          : `${file.lines} LOC (Grenze ${file.limit}). Reduziere auf hoechstens ${file.hotZone} LOC, um die Hot Zone zu verlassen.`;
    fail(index + 1, 'ERR-4012', file.name, reason);
  });
  process.exit(1);
}

if (hotFiles.length > 0) {
  const changedHot = hotFiles.filter((file) => file.hotChange).length;
  console.log(`\ncheck:loc - ${hotFiles.length} Datei(en) in der Hot Zone, ${changedHot} in diesem Lauf geaendert. Aenderungen muessen modularisiert oder als ASK_USER begruendet werden.`);
}
console.log('\ncheck:loc - OK, alle Dateien innerhalb ihres Budgets');
