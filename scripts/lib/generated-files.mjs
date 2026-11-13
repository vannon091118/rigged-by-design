/**
 * Generierte Artefakte: eine Liste, ein Eigentuemer, ein Regenerationspfad.
 *
 * Ein Konflikt ist nicht automatisch ein Merge-Problem. Diese Datei trennt die
 * drei Faelle, die bisher durch dieselbe Logik liefen:
 * - generiert: der Inhalt entsteht deterministisch aus Quellen; ein Konflikt
 *   wird regeneriert, nie verhandelt.
 * - Quelle: Handarbeit; ein Konflikt ist fachlich und bleibt `MANUAL_CONFLICT`.
 * - Marker: mechanische Doku-Zeile; sie zaehlt nie als inhaltliche Aenderung.
 *
 * Die Liste ist die eine Wahrheit fuer Pre-Commit, Pre-Push, Lane-Claims und
 * den CI-Plan. Ein neuer Generator traegt sich hier ein, statt in vier Skripten
 * eine fuenfte Sonderregel zu erfinden.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { quotaTotal } from './narrative-blocks.mjs';
import { ROOT } from './report.mjs';

export const INVENTORY_START = '<!-- inventory:start -->';
export const INVENTORY_END = '<!-- inventory:end -->';

/** Fortschrittszeile der Roadmap: reiner Wert, abgeleitet aus der Registry. */
export const ROADMAP_PROGRESS = /^(\|\s*P-13\s*\|\s*)(\d+)(\s*\/\s*1500\s+(?:gewertete\s+)?Textbausteine)/m;

/** Doku-Marker, mit und ohne fuehrendes Diff-Zeichen. */
const MARKER = /^(\s*<!--\s*rbd-doc:.*-->\s*)$/;
const DIFF_MARKER = /^[+-]\s*<!--\s*rbd-doc:.*-->\s*$/;
const EMPTY_DIFF = /^[+-]\s*$/;

/**
 * `mode` sagt, wie viel des Artefakts der Generator besitzt:
 * - `whole`: die ganze Datei (Registry, Inventurblock-Datei)
 * - `progress`: nur die abgeleitete Fortschrittszeile
 * - `marker`: nur eine mechanische Markerzeile
 */
export const GENERATED_FILES = Object.freeze({
  'docs/INVENTORY.md': Object.freeze({ owner: 'scripts/build-inventory.mjs', mode: 'whole' }),
  'docs/ROADMAP.md': Object.freeze({ owner: 'scripts/sync-generated.mjs', mode: 'progress' }),
  'content/narrative/registry/fragments.json': Object.freeze({
    owner: 'scripts/compile-narrative-content.mjs',
    mode: 'whole',
  }),
  'src/core/sim/narrative/composer/registry.generated.ts': Object.freeze({
    owner: 'scripts/compile-narrative-content.mjs',
    mode: 'whole',
  }),
  'src/core/sim/narrative/composer/slot-map.generated.ts': Object.freeze({
    owner: 'scripts/compile-narrative-content.mjs',
    mode: 'whole',
  }),
});

export const GENERATED_PATHS = Object.freeze(Object.keys(GENERATED_FILES));

/** Pfade, deren Generator bei jeder Aenderung mitlaufen muss. */
export const NARRATIVE_SOURCE_PREFIX = 'content/narrative/';

export function isGeneratedPath(file) {
  return GENERATED_PATHS.includes(String(file ?? '').replaceAll('\\', '/'));
}

export function generatedOwner(file) {
  return GENERATED_FILES[String(file ?? '').replaceAll('\\', '/')]?.owner ?? null;
}

/** True, wenn die Zeile ein mechanischer Doku-Marker ist. */
export function isMarkerLine(line) {
  const value = String(line ?? '');
  return DIFF_MARKER.test(value) || MARKER.test(value) || EMPTY_DIFF.test(value);
}

/** Fortschrittszahl aus der Roadmap; `null`, wenn die Zeile fehlt. */
export function roadmapProgress(text) {
  const match = ROADMAP_PROGRESS.exec(String(text ?? ''));
  return match ? Number(match[2]) : null;
}

/** Setzt die Fortschrittszahl; ohne Treffer bleibt der Text unveraendert. */
export function applyRoadmapProgress(text, count) {
  const value = String(text ?? '');
  const match = ROADMAP_PROGRESS.exec(value);
  if (!match || !Number.isFinite(Number(count))) return value;
  if (Number(match[2]) === Number(count)) return value;
  return value.replace(ROADMAP_PROGRESS, `$1${Number(count)}$3`);
}

/** Die gemessene Fragmentzahl aus der kompilierten Registry; `null` ohne Datei. */
export function registryFragmentCount(root = ROOT) {
  try {
    const file = join(root, 'content', 'narrative', 'registry', 'fragments.json');
    const document = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(document?.fragments) ? document.fragments.length : null;
  } catch {
    return null;
  }
}

/** Der gewertete Fortschritt aus der Registry; `null` ohne lesbare Datei. */
export function registryQuotaCount(root = ROOT) {
  try {
    const file = join(root, 'content', 'narrative', 'registry', 'fragments.json');
    const document = JSON.parse(readFileSync(file, 'utf8'));
    const fragments = Array.isArray(document?.fragments) ? document.fragments : [];
    if (fragments.length === 0 && !Array.isArray(document?.fragments)) return null;
    const counts = {};
    for (const fragment of fragments) counts[fragment.slot] = (counts[fragment.slot] ?? 0) + 1;
    return quotaTotal(counts, fragments.length);
  } catch {
    return null;
  }
}

/**
 * Prueft geaenderte Diff-Zeilen einer Datei gegen ihren Generator-Anteil.
 * `lines === null` heisst "Diff nicht lesbar" und ist bewusst kein Freibrief.
 */
export function generatedOnlyDiff(file, lines) {
  const path = String(file ?? '').replaceAll('\\', '/');
  if (lines === null) return false;
  if (!Array.isArray(lines) || lines.length === 0) return true;
  const entry = GENERATED_FILES[path];
  if (!entry) return lines.every(isMarkerLine);
  if (entry.mode === 'whole') return true;
  if (entry.mode === 'marker') return lines.every(isMarkerLine);
  if (entry.mode === 'progress') {
    return lines.every((line) => isMarkerLine(line) || /^[+-]\s*\|\s*P-13\s*\|.*\/\s*1500/.test(line));
  }
  return false;
}

/**
 * Konfliktklassifikation: `generated` wird regeneriert, `source` nie.
 * Ein gemischter Konflikt ist ein Quellkonflikt: sobald eine Handdatei
 * betroffen ist, entscheidet der Mensch.
 */
export function classifyConflicts(paths) {
  const generated = [];
  const source = [];
  for (const path of [...new Set(paths ?? [])]) {
    const clean = String(path ?? '').replaceAll('\\', '/');
    if (!clean) continue;
    if (isGeneratedPath(clean)) generated.push(clean);
    else source.push(clean);
  }
  return {
    generated: generated.sort(),
    source: source.sort(),
    status: source.length > 0 ? 'MANUAL_CONFLICT' : generated.length > 0 ? 'REGENERATE' : 'READY',
  };
}
