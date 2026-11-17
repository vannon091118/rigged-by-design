/**
 * Pflichtdoku: eine Liste, ein Marker, eine Pruefung.
 *
 * Der Marker ist stabil und traegt keine Version und keinen Zeitstempel mehr.
 * Der Pre-Commit-Hook ergaenzt ihn nur, wenn er fehlt; bestehende Marker bleiben
 * unangetastet. Dadurch erzeugt kein Commit mehr dieselbe Doku-Aenderung in
 * allen Lanes. `verify:docs` prueft Marker und Pflichtabschnitte, kein Alter.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CORE_DOCS } from './doc-core.mjs';
import { verifyReadmeMedia } from './readme-media.mjs';
import { ROOT } from './report.mjs';

/**
 * Die fuenf Pflichtdokus sind der Doku-Kern. Alles andere ist Referenz und
 * wird bei Bedarf geladen; `docs/INVENTORY.md` bleibt ein generiertes
 * Nachweisartefakt, keine Pflichtlektuere.
 */
export const DOC_SET = Object.freeze(
  CORE_DOCS.map((doc) => ({ path: doc.path, title: doc.title, sections: doc.sections })),
);

const MARKER = /<!--\s*rbd-doc:\s*([^>]*?)\s*-->/;
const STANDALONE_MARKER = /^[ \t]*<!--[ \t]*rbd-doc:[ \t]*([^>]*?)[ \t]*-->[ \t]*$/m;
const STANDALONE_MARKER_ALL = /^[ \t]*<!--[ \t]*rbd-doc:[ \t]*([^>]*?)[ \t]*-->[ \t]*$/gm;
export const MANAGED_MARKER = '<!-- rbd-doc: managed -->';
const ROOT_DOCS = new Set(['README.md', 'AGENTS.md']);

/** Liest alte und neue Marker; nur der alte Marker traegt Version und Zeitstempel. */
export function markerOf(text) {
  const match = MARKER.exec(text);
  if (!match) return null;
  const value = match[1].trim();
  const versioned = /^v([^ |]+)\s*\|\s*(.+)$/.exec(value);
  return versioned
    ? { managed: false, version: versioned[1], stamp: versioned[2] }
    : { managed: true };
}

/**
 * Ein Marker, ein Format. Alte Versionsmarker (`v0.3.x | Zeitstempel`) werden
 * auf den kanonischen Marker normalisiert; ein bereits kanonischer Marker
 * bleibt unveraendert. Damit erzeugt kein Commit mehr Versions-Churn, und
 * `verify:docs` braucht keine zweite Schreibweise.
 */
export function applyMarker(text) {
  const value = String(text ?? '');
  // Nur eigenstaendige Markerzeilen sind der Doku-Marker; Marker in
  // Fliesstext oder Code-Spans sind zitierter Inhalt und bleiben unangetastet.
  // Sonst wuerde die Normalisierung Geschichte umschreiben und jede erwaehnte
  // Version als Doku-Churn in fremde Lanes tragen.
  const match = STANDALONE_MARKER.exec(value);
  if (match) {
    const versioned = /^v[^ |]+\s*\|\s*.+$/.test(match[1].trim());
    const next = versioned ? value.replace(match[0], MANAGED_MARKER) : value;
    // Ein Marker, ein Format: spaetere eigenstaendige Markerzeilen sind keine
    // zweite Wahrheit und werden entfernt. Sonst erzeugt ein schlechter Merge
    // zwei kanonische Marker, die jeder Gate-Lauf als Doku-Churn sieht.
    let first = true;
    return next.replace(STANDALONE_MARKER_ALL, (entry) => {
      if (first) {
        first = false;
        return entry;
      }
      return '';
    });
  }
  const lines = text.split('\n');
  lines.splice(1, 0, '', MANAGED_MARKER);
  return lines.join('\n');
}

/** Schreibt fehlende Marker in jedes Pflichtdokument; gibt die geaenderten Pfade zurueck. */
export function syncDocs() {
  const changed = [];
  for (const doc of DOC_SET) {
    const file = join(ROOT, doc.path);
    if (!existsSync(file)) continue;
    const before = readFileSync(file, 'utf8');
    const next = applyMarker(before);
    if (next !== before) {
      writeFileSync(file, next);
      changed.push(doc.path);
    }
  }
  return changed;
}

/** Strukturpruefung: Existenz, Marker, Pflichtabschnitte, flacher Wurzelbaum. */
export function verifyDocs() {
  const problems = [];
  const seen = new Set();
  for (const doc of DOC_SET) {
    const file = join(ROOT, doc.path);
    if (!existsSync(file)) {
      problems.push(`${doc.path}: Pflichtdokument fehlt (${doc.title}).`);
      continue;
    }
    if (!doc.path.startsWith('docs/')) seen.add(basename(doc.path));
    const text = readFileSync(file, 'utf8');
    const marker = markerOf(text);
    if (!marker) problems.push(`${doc.path}: rbd-doc-Marker fehlt.`);
    for (const section of doc.sections) {
      if (!text.includes(section)) problems.push(`${doc.path}: Pflichtabschnitt "${section}" fehlt.`);
    }
  }
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    // Dotfiles (.turn-notes.md und Verwandte) sind Arbeitsdateien des Turns, keine Wurzel-Doku.
    if (entry.name.startsWith('.')) continue;
    if (ROOT_DOCS.has(entry.name)) continue;
    problems.push(`${entry.name}: Markdown gehoert nicht in die Wurzel (nur README.md und AGENTS.md).`);
  }
  for (const entry of readdirSync(join(ROOT, 'docs'), { withFileTypes: true })) {
    if (entry.isFile() && seen.has(entry.name)) problems.push(`docs/${entry.name}: doppelt zur Wurzel.`);
  }
  problems.push(...verifyReadmeMedia());
  return problems;
}
