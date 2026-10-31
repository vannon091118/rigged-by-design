/**
 * Testkatalog: jede Testdatei gehoert genau einem System und genau einer
 * Beweisklasse. Der Katalog ist abgeleitet, nicht gepflegt: System aus dem
 * deklarierten @test-target, Beweisklasse aus der Rolle der Datei. Die
 * Zuordnung steht in `docs/TEST-CATALOG.md` und wird dort geprueft, damit eine
 * neue Testdatei nicht unbemerkt ohne Einordnung bleibt.
 */
import { resolve } from 'node:path';
import { relative } from 'node:path';
import { ts } from './ts-ast.mjs';
import { parse } from './ts-ast.mjs';
import { ROOT, walk } from './report.mjs';

/** Beweisklassen von schwach (Vertrag) nach teuer (Statistik, Messung). */
export const PROOF_CLASSES = Object.freeze(['contract', 'integration', 'governance', 'statistics', 'performance']);
/** Klassen, die lokal nicht laufen: sie brauchen Minuten und gehoeren in CI. */
export const LONG_PROOF_CLASSES = Object.freeze(['statistics', 'performance']);

const SYSTEMS = Object.freeze([
  ['src/core/games', 'games'],
  ['src/core/sim', 'sim'],
  ['src/core/economy', 'economy'],
  ['src/core/rng', 'rng'],
  ['src/core/physics', 'physics'],
  ['src/core/governance', 'governance'],
  ['src/render', 'render'],
  ['src/ui', 'ui'],
  ['src/store', 'store'],
  ['src/test', 'test-tools'],
  ['scripts', 'pipeline'],
  ['.github', 'ci'],
]);

/** Statistik-Suiten: Sampling, RTP, Langlauf. Der Name entscheidet, nicht der Ordner. */
const STATISTICS = /(^|\/)(round-rtp-[^/]*|slot-session-rtp|poker-distribution|soak|balance-operating)(\.test)?\.tsx?$/;

export const CATALOG_START = '<!-- TEST_CATALOG_START -->';
export const CATALOG_END = '<!-- TEST_CATALOG_END -->';

/** Testdatei aus dem Kopfkommentar; die Datei selbst entscheidet, was sie prueft. */
export function testTargetOf(file) {
  const source = parse(resolve(ROOT, file));
  const comments = ts.getLeadingCommentRanges(source.getFullText(), 0) ?? [];
  const header = comments.map((range) => source.getFullText().slice(range.pos, range.end)).join('\n');
  return /@test-target:\s*([^\s|*]+)/.exec(header)?.[1] ?? null;
}

export function systemOfTarget(target) {
  if (!target) return 'unknown';
  const normalized = target.replaceAll('\\', '/');
  const hit = SYSTEMS.find(([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'other';
}

export function proofClassOf(file) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.endsWith('.bench.ts')) return 'performance';
  if (STATISTICS.test(normalized)) return 'statistics';
  const target = testTargetOf(normalized) ?? '';
  if (normalized.includes('/__tests__/') && (target.startsWith('scripts/') || target.startsWith('.github/'))) return 'governance';
  if (/^src\/(ui|render|store)\//.test(target)) return 'integration';
  return 'contract';
}

/** Alle Test- und Messdateien unter src, sortiert. */
export function testFiles() {
  return walk(resolve(ROOT, 'src'), (file) => /\.(test\.tsx?|bench\.ts)$/.test(file))
    .map((file) => relative(ROOT, resolve(file)).replaceAll('\\', '/'))
    .sort();
}

/** Der Katalog als Zeilen: Datei, System, Beweisklasse, deklariertes Ziel. */
export function catalogEntries(files = testFiles()) {
  return files.map((file) => {
    const target = testTargetOf(file);
    const proof = proofClassOf(file);
    return { file, target, system: systemOfTarget(target), proof, long: LONG_PROOF_CLASSES.includes(proof) };
  });
}

/** Trennt eine Testauswahl in lokal laufbare und an CI delegierte Nachweise. */
export function partitionByProof(tests) {
  const fast = [];
  const long = [];
  for (const test of tests) (LONG_PROOF_CLASSES.includes(proofClassOf(test)) ? long : fast).push(test);
  return { fast, long };
}

export function renderCatalog(entries = catalogEntries()) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.proof, (counts.get(entry.proof) ?? 0) + 1);
  const summary = PROOF_CLASSES.map((proof) => `${proof} ${counts.get(proof) ?? 0}`).join(' · ');
  const rows = entries.map((entry) => {
    const target = entry.target ? `\`${entry.target}\`` : '—';
    const local = entry.long ? 'nein, CI' : 'ja';
    return `| \`${entry.file}\` | ${entry.system} | ${entry.proof} | ${local} | ${target} |`;
  });
  return [
    CATALOG_START,
    `Summe: ${entries.length} Dateien — ${summary}.`,
    '',
    '| Testdatei | System | Beweisklasse | Lokal | Deklariertes Ziel |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    CATALOG_END,
  ].join('\n');
}
