/**
 * Testkatalog: jede Testdatei gehoert genau einem System und genau einer
 * Beweisklasse. Der Katalog ist abgeleitet, nicht gepflegt: System aus dem
 * deklarierten @test-target, Beweisklasse aus der Rolle der Datei. Die
 * Zuordnung steht in `docs/INVENTORY.md` und wird dort geprueft, damit eine
 * neue Testdatei nicht unbemerkt ohne Einordnung bleibt.
 */
import { resolve } from 'node:path';
import { relative } from 'node:path';
import { CATALOG_SYSTEMS } from './subsystems.mjs';
import { headerCommentOf } from './imports.mjs';
import { ROOT, walk } from './report.mjs';

/** Beweisklassen von schwach (Vertrag) nach teuer (Statistik, Messung). */
export const PROOF_CLASSES = Object.freeze(['contract', 'integration', 'governance', 'statistics', 'performance']);
/** Klassen, die lokal nicht laufen: sie brauchen Minuten und gehoeren in CI. */
export const LONG_PROOF_CLASSES = Object.freeze(['statistics', 'performance']);

/** Systeme je Prefix; die Tabelle steht in scripts/lib/subsystems.mjs. */
const SYSTEMS = CATALOG_SYSTEMS;

/** Statistik-Suiten: Sampling, RTP, Langlauf. Der Name entscheidet, nicht der Ordner. */
const STATISTICS = /(^|\/)(round-rtp-[^/]*|slot-session-rtp|poker-distribution|soak|balance-operating)(\.test)?\.tsx?$/;

export const CATALOG_START = '<!-- TEST_CATALOG_START -->';
export const CATALOG_END = '<!-- TEST_CATALOG_END -->';

/** Kopfkommentar einer Testdatei; ohne Compiler, damit auch der Impact ihn
 * in einem nackten Checkout lesen kann. */
function headerOf(file) {
  return headerCommentOf(resolve(ROOT, file));
}

/** Testdatei aus dem Kopfkommentar; die Datei selbst entscheidet, was sie prueft. */
export function testTargetOf(file) {
  return /@test-target:\s*([^\s|*]+)/.exec(headerOf(file))?.[1] ?? null;
}

export function systemOfTarget(target) {
  if (!target) return 'unknown';
  const normalized = target.replaceAll('\\', '/');
  const hit = SYSTEMS.find(([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'other';
}

export function proofClassOf(file) {
  const normalized = file.replaceAll('\\', '/');
  // Eine deklarierte Klasse steht ueber jeder Ableitung aus dem Dateinamen:
  // der Narrative-Langlauf heisst nicht "soak", braucht aber dieselbe
  // CI-Delegation wie die uebrigen teuren Nachweise.
  const declared = /@proof-class:\s*([a-z-]+)/.exec(headerOf(normalized))?.[1];
  if (PROOF_CLASSES.includes(declared)) return declared;
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
