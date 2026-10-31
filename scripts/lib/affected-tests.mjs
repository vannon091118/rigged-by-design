/**
 * Betroffene Tests: deklariertes @test-target, direkte Importkante und das
 * betroffene Spiel-/Simulationssubsystem. Das ist Entwicklungsfeedback, kein
 * Ersatz fuer `verify:all`: eine Auswahl kann Tests ausserhalb des Graphen
 * uebersehen, deshalb bleiben full und release immer vollstaendig.
 */
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { ROOT, walk } from './report.mjs';
import { moduleSpecifiers, parse, resolveSpecifier, ts } from './ts-ast.mjs';

const TEST_RE = /\.test\.(ts|tsx)$/;
const CODE_RE = /\.(ts|tsx|js|mjs|cjs)$/;
const CONFIG_RE = /^(package(?:-lock)?\.json|tsconfig\.json|vite\.config\.ts|eslint\.config\.mjs)$/;
const normalize = (file) => file.replaceAll('\\', '/');
const relativeToRoot = (file) => normalize(relative(ROOT, resolve(file)));

/** Alle Testdateien unter src, relativ zum Repository. */
export function listTests() {
  return walk(resolve(ROOT, 'src'), (file) => TEST_RE.test(file))
    .map((file) => relativeToRoot(file))
    .sort();
}

function targetOf(file) {
  const source = parse(resolve(ROOT, file));
  const comments = ts.getLeadingCommentRanges(source.getFullText(), 0) ?? [];
  const header = comments.map((range) => source.getFullText().slice(range.pos, range.end)).join('\n');
  return /@test-target:\s*([^\s|*]+)/.exec(header)?.[1] ?? null;
}

function importsOf(file) {
  const full = resolve(ROOT, file);
  const imports = new Set();
  for (const specifier of moduleSpecifiers(parse(full))) {
    const resolved = resolveSpecifier(specifier, full);
    if (resolved) imports.add(relativeToRoot(resolved));
  }
  return imports;
}

/** Grobes System, damit eine Aenderung nicht nur den exakt gleichnamigen Test trifft. */
function subsystemOf(file) {
  for (const prefix of [
    'src/core/games', 'src/core/sim', 'src/core/economy', 'src/core/rng', 'src/core/governance',
    'src/render', 'src/ui', 'src/store', 'scripts', '.github',
  ]) {
    if (file === prefix || file.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

/**
 * Liefert die Testdateien, die von den geaenderten Pfaden beruehrt werden.
 * Konfigurationsaenderungen und ein leerer Treffer bei Code fallen auf alle
 * Tests zurueck; reine Doku laesst die Auswahl leer.
 */
export function selectAffectedTests(changedFiles) {
  const changed = [...new Set(changedFiles.map((file) => normalize(file).replace(/^\.\//, '')).filter(Boolean))];
  const all = listTests();
  if (changed.length === 0) return { tests: [], runAll: false, reason: 'keine Aenderungen' };

  const targets = new Map(all.map((test) => [test, targetOf(test)]));
  const imports = new Map(all.map((test) => [test, importsOf(test)]));
  const selected = new Set();
  let runAll = false;
  let codeChanged = false;

  for (const file of changed) {
    if (CONFIG_RE.test(file)) {
      runAll = true;
      continue;
    }
    if (TEST_RE.test(file)) {
      selected.add(file);
      continue;
    }
    if (!CODE_RE.test(file) && !file.startsWith('.github/')) continue;
    codeChanged = true;
    const subsystem = subsystemOf(file);

    for (const test of all) {
      if (targets.get(test) === file || imports.get(test)?.has(file)) selected.add(test);
      if (subsystem && targets.get(test)?.startsWith(`${subsystem}/`)) selected.add(test);
    }
  }

  if (!runAll && codeChanged && selected.size === 0) {
    runAll = true;
    return { tests: all, runAll, reason: 'kein direkter Treffer, alle Tests' };
  }
  return {
    tests: runAll ? all : [...selected].sort(),
    runAll,
    reason: null,
  };
}

/** Geaenderte Pfade aus Branch, Index und Arbeitsbaum; Fehler werden bewusst verschluckt. */
export function changedFiles() {
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMR', 'origin/main...HEAD'],
    ['diff', '--name-only', '--diff-filter=ACMR'],
    ['diff', '--name-only', '--cached', '--diff-filter=ACMR'],
  ];
  const found = new Set();
  for (const args of commands) {
    try {
      const output = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of output.split(/\r?\n/)) if (line.trim()) found.add(line.trim());
    } catch {
      // Kein origin/main oder kein Git: die naechste Quelle versuchen.
    }
  }
  return [...found];
}
