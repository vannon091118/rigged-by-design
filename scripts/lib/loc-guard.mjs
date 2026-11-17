/**
 * LOC-Guard-Kern: zaehlt Logikzeilen in src/ und scripts/ gegen die
 * Rollenbudgets aus `scripts/loc-budgets.mjs`.
 *
 * Die Extraktion trennt Scanregeln von CLI-Ausgabe. Beide Wurzeln gelten:
 * Produktcode und Werkzeuge wachsen sonst an derselben Grenze vorbei.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { budgetFor, LEGACY_LOC } from '../loc-budgets.mjs';

export const SOURCE_ROOTS = Object.freeze(['src', 'scripts']);
const EXCEPTION_TAG = '// @loc-exception:';
/** Reine Textbausteine: Daten, keine Logik. */
const TEXT_DATA = new Set(['src/core/sim/narrative/composer/registry.generated.ts']);
/** Event-Templates beschreiben Szenen und Choices; das Budget gilt der Engine. */
const TEMPLATE_DIR = 'src/core/sim/narrative/events/definitions/';
const SOURCE_EXT = /\.(ts|tsx|mjs)$/;

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
    else if (entry.isFile() && SOURCE_EXT.test(entry.name)) found.push(full);
  }
  return found;
}

/** Zaehlt Code-Zeilen ohne Kommentare und Leerzeilen; String-Literale bleiben Code. */
export function countCodeLines(text) {
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

/** Pfade, die dieser Lauf gegenueber der Basis geaendert hat. */
export function changedPaths({ root, base = process.env.RBD_LOC_BASE || '' } = {}) {
  let resolved = base;
  if (!resolved) {
    for (const ref of ['origin/main', 'HEAD^']) {
      try {
        resolved = execFileSync('git', ['merge-base', 'HEAD', ref], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (resolved) break;
      } catch {
        // Naechste Basis versuchen.
      }
    }
  }
  if (!resolved) return new Set();
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', resolved], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(output.split(/\r?\n/).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Scannt beide Wurzeln und liefert Dateien, Hot Zone und Verstoesse. */
export function scanLoc({ root, changed = changedPaths({ root }), roots = SOURCE_ROOTS } = {}) {
  const skipped = [];
  const files = [];
  for (const dirName of roots) {
    const dir = join(root, dirName);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const text = readFileSync(file, 'utf8');
      const name = relative(root, file).split(sep).join('/');
      const reason = skipReason(name);
      if (reason) {
        skipped.push({ name, reason });
        continue;
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
      files.push({ name, lines, limit, hotZone, budget: budget.id, legacy, exception, unauthorized, overLimit, stale, hot, hotChange });
    }
  }
  files.sort((a, b) => b.lines - a.lines);
  return {
    files,
    skipped,
    violations: files.filter((file) => file.unauthorized || file.overLimit || file.stale || file.hotChange),
    hotFiles: files.filter((file) => file.hot),
  };
}
