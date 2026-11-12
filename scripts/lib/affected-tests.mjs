/**
 * Betroffene Tests: deklariertes @test-target, der echte Importgraph und das
 * betroffene Spiel-/Simulationssubsystem. Das ist Entwicklungsfeedback, kein
 * Ersatz fuer `verify:all`: eine Auswahl kann Tests ausserhalb des Graphen
 * uebersehen, deshalb bleiben full und release immer vollstaendig.
 *
 * Der Graph wird rueckwaerts gelesen: geaendert ist, wer das Geaenderte
 * transitiv importiert. Damit trifft eine Aenderung tief im Modell auch die
 * Tests, die nur ueber einen Zwischenmodul davon abhaengen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { refreshBase } from './base-refresh.mjs';
import { ROOT, walk } from './report.mjs';
import { subsystemPrefixOf } from './subsystems.mjs';
import { testTargetOf } from './test-catalog.mjs';
// Bewusst ohne TypeScript: der Impact muss auch ohne `node_modules` laufen,
// sonst blockiert `pretask` mit "Impact-Plan fehlt" statt zu pruefen.
import { resolveSpecifier, specifiersOf } from './imports.mjs';

const TEST_RE = /\.test\.(ts|tsx)$/;
const CODE_RE = /\.(ts|tsx|js|mjs|cjs)$/;
const NARRATIVE_DATA_RE = /^content\/narrative\/.*\.json$/;
const NARRATIVE_CONTENT_TEST = 'src/core/governance/__tests__/narrative-content.test.ts';
const CONFIG_RE = /^(package(?:-lock)?\.json|tsconfig\.json|vite\.config\.ts|eslint\.config\.mjs)$/;
const normalize = (file) => file.replaceAll('\\', '/');
const relativeToRoot = (file) => normalize(relative(ROOT, resolve(file)));

/** Alle Testdateien unter src, relativ zum Repository. */
export function listTests() {
  const src = resolve(ROOT, 'src');
  // Ein Fixture-Repo ohne src ist ein gueltiger, leerer Testbaum; der Impact
  // liefert dann eine leere Auswahl statt mit ENOENT zu blockieren.
  if (!existsSync(src)) return [];
  return walk(src, (file) => TEST_RE.test(file))
    .map((file) => relativeToRoot(file))
    .sort();
}

/** Jedes Modul, das importiert werden kann: src und die Gate-Skripte. */
function moduleFiles() {
  const roots = [resolve(ROOT, 'src'), resolve(ROOT, 'scripts')].filter((dir) => existsSync(dir));
  return roots
    .flatMap((dir) => walk(dir, (file) => CODE_RE.test(file) && !file.endsWith('.d.ts')))
    .map((file) => relativeToRoot(file));
}

function importsOf(file) {
  const full = resolve(ROOT, file);
  const imports = new Set();
  for (const specifier of specifiersOf(full)) {
    const resolved = resolveSpecifier(specifier, full);
    if (resolved) imports.add(relativeToRoot(resolved));
  }
  return imports;
}

let graphCache;
/** Kante Modul -> importierte Module, einmal pro Prozess. */
function moduleGraph() {
  if (graphCache) return graphCache;
  const graph = new Map();
  for (const file of moduleFiles()) graph.set(file, importsOf(file));
  graphCache = graph;
  return graph;
}

/** Umgekehrte Kanten: importiertes Modul -> importierende Module. */
function reverseIndex(graph) {
  const reverse = new Map();
  for (const [file, imports] of graph) {
    for (const imported of imports) {
      if (!reverse.has(imported)) reverse.set(imported, new Set());
      reverse.get(imported).add(file);
    }
  }
  return reverse;
}

/** Alles, was die Seeds selbst ist oder transitiv importiert. */
function dependents(seeds, graph, reverse = reverseIndex(graph)) {
  const seen = new Set();
  const queue = [];
  for (const seed of seeds) {
    if (!graph.has(seed) || seen.has(seed)) continue;
    seen.add(seed);
    queue.push(seed);
  }
  while (queue.length > 0) {
    for (const dependent of reverse.get(queue.pop()) ?? []) {
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      queue.push(dependent);
    }
  }
  return seen;
}

/** Grobes System, damit eine Aenderung ohne Graphtreffer noch Recall hat. */
export function subsystemOf(file) {
  return subsystemPrefixOf(file);
}

/**
 * Liefert die Testdateien, die von den geaenderten Pfaden beruehrt werden.
 * Konfigurationsaenderungen fallen auf alle Tests zurueck; reine Doku laesst
 * die Auswahl leer.
 */
export function selectAffectedTests(changedFiles) {
  const changed = [...new Set(changedFiles.map((file) => normalize(file).replace(/^\.\//, '')).filter(Boolean))];
  const all = listTests();
  if (changed.length === 0) return { tests: [], runAll: false, reason: 'keine Aenderungen' };

  const targets = new Map(all.map((test) => [test, testTargetOf(test)]));
  const graph = moduleGraph();
  const reverse = reverseIndex(graph);
  const testSet = new Set(all);
  const selected = new Set();
  let runAll = false;
  let codeChanged = false;
  const outsideGraph = [];

  for (const file of changed) {
    if (CONFIG_RE.test(file)) {
      runAll = true;
      continue;
    }
    if (TEST_RE.test(file)) {
      selected.add(file);
      continue;
    }
    if (file.startsWith('.github/') || file.startsWith('scripts/local-ci')) {
      codeChanged = true;
      for (const test of all) {
        const target = targets.get(test);
        if (target?.startsWith('.github/') || target === 'scripts/local-ci.mjs') selected.add(test);
      }
      continue;
    }
    if (NARRATIVE_DATA_RE.test(file)) {
      codeChanged = true;
      selected.add(NARRATIVE_CONTENT_TEST);
      continue;
    }
    if (!CODE_RE.test(file)) continue;
    codeChanged = true;
    if (graph.has(file)) {
      for (const dependent of dependents([file], graph, reverse)) if (testSet.has(dependent)) selected.add(dependent);
    } else {
      outsideGraph.push(file);
    }
  }

  // Treffer ausserhalb des Graphen (etwa ein neues Modul) und der Fall ohne
  // jeden Treffer fallen auf das Subsystem zurueck, bevor alles laeuft.
  if (selected.size === 0 || outsideGraph.length > 0) {
    for (const file of outsideGraph) {
      const subsystem = subsystemOf(file);
      for (const test of all) if (subsystem && targets.get(test)?.startsWith(`${subsystem}/`)) selected.add(test);
    }
  }
  if (!runAll && codeChanged && selected.size === 0) {
    return { tests: all, runAll: true, reason: 'kein direkter Treffer, alle Tests' };
  }
  return { tests: runAll ? all : [...selected].sort(), runAll, reason: null };
}

/**
 * Geaenderte Pfade aus Branch, Index, Arbeitsbaum und unversionierten Dateien;
 * Fehler werden bewusst verschluckt. Neue Module sind der haeufigste Fall, in
 * dem eine Auswahl zu klein ausfaellt - sie stehen in keiner Diff-Quelle,
 * solange sie nicht gestaged sind.
 */
export function changedFiles({ fetch = false } = {}) {
  // Nur `pretask` aktualisiert die Basis bewusst. Ein Testlauf oder Kontext
  // darf nicht bei jedem Aufruf auf das Netz warten; der TTL-Cache allein
  // waere fuer einen einzelnen Prozess kein Gewinn.
  if (fetch) refreshBase({ cwd: ROOT });
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMR', 'origin/main...HEAD'],
    ['diff', '--name-only', '--diff-filter=ACMR'],
    ['diff', '--name-only', '--cached', '--diff-filter=ACMR'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  const found = new Set();
  for (const args of commands) {
    // `ls-files --others` listet wie die Diff-Aufrufe nur Pfade, keine Statusspalten.
    try {
      const output = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of output.split(/\r?\n/)) if (line.trim()) found.add(line.trim());
    } catch {
      // Kein origin/main oder kein Git: die naechste Quelle versuchen.
    }
  }
  return [...found];
}
