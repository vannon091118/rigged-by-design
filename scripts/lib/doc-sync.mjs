/**
 * Pflichtdoku: eine Liste, ein Marker, eine Pruefung.
 *
 * Der Marker ist stabil und traegt keine Version und keinen Zeitstempel mehr.
 * Der Pre-Commit-Hook ergaenzt ihn nur, wenn er fehlt; bestehende Marker bleiben
 * unangetastet. Dadurch erzeugt kein Commit mehr dieselbe Doku-Aenderung in
 * allen Lanes. `verify:docs` prueft Marker und Pflichtabschnitte, kein Alter.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ROOT } from './report.mjs';

const INVENTORY_START = '<!-- inventory:start -->';
const INVENTORY_END = '<!-- inventory:end -->';

/** Abdeckung: jede getrackte Datei und jeder Ordner muss im Inventar stehen. */
function inventoryProblems() {
  const file = join(ROOT, 'docs', 'INVENTORY.md');
  if (!existsSync(file)) return ['docs/INVENTORY.md fehlt.'];
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf(INVENTORY_START);
  const end = text.indexOf(INVENTORY_END);
  if (start < 0 || end <= start) return ['docs/INVENTORY.md: inventory:start/end-Marker fehlen.'];
  const block = text.slice(start, end);
  const listed = new Set([...block.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]));
  const listedDirs = new Set([...listed].filter((entry) => entry.endsWith('/')).map((entry) => entry.slice(0, -1)));
  const files = listedDirs.size > 0 ? [...listed].filter((entry) => !entry.endsWith('/')) : [...listed];
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  const trackedSet = new Set(tracked);
  const dirs = [...new Set(tracked.map((entry) => dirname(entry)))].sort();
  const problems = [];
  const missing = tracked.filter((entry) => !files.includes(entry));
  const extra = files.filter((entry) => !trackedSet.has(entry));
  const missingDirs = dirs.filter((entry) => !listedDirs.has(entry));
  const extraDirs = [...listedDirs].filter((entry) => !dirs.includes(entry));
  const count = /\| Getrackte Dateien \| (\d+) \|/.exec(block);
  if (!count || Number(count[1]) !== tracked.length) {
    problems.push(`docs/INVENTORY.md: Abdeckungszahl ${count?.[1] ?? 'fehlt'} passt nicht zu ${tracked.length} getrackten Dateien.`);
  }
  for (const entry of missing.slice(0, 12)) problems.push(`docs/INVENTORY.md: getrackte Datei fehlt: ${entry}`);
  if (missing.length > 12) problems.push(`docs/INVENTORY.md: ${missing.length - 12} weitere Dateien fehlen.`);
  for (const entry of extra.slice(0, 6)) problems.push(`docs/INVENTORY.md: Pfad ist nicht getrackt: ${entry}`);
  for (const entry of missingDirs.slice(0, 6)) problems.push(`docs/INVENTORY.md: Ordner fehlt: ${entry}/`);
  for (const entry of extraDirs.slice(0, 6)) problems.push(`docs/INVENTORY.md: Ordner ist nicht getrackt: ${entry}/`);
  return problems;
}

export const DOC_SET = Object.freeze([
  { path: 'docs/INVENTORY.md', title: 'Inventar', sections: ['## 1.', '## Fortsetzungs-Log'] },
  { path: 'docs/CHANGELOG.md', title: 'Changelog', sections: ['## Regeln', '## ['] },
  { path: 'docs/DEVTAGEBUCH.md', title: 'Devtagebuch', sections: ['## Regeln', '## 2026-'] },
  { path: 'docs/ARCHITECTURE.md', title: 'Architektur', sections: ['## Zustandsbesitz', '## Pipeline', '## Delivery-Regel'] },
  { path: 'docs/ROADMAP.md', title: 'Roadmap', sections: ['## Jetzt', '## Als Nächstes', '## Später'] },
  { path: 'docs/WORKFLOW.md', title: 'Workflow', sections: ['## Einstieg', '## Arbeitsablauf', '## Abschluss', '## Referenzen'] },
  { path: 'docs/AGENT-ONBOARDING.md', title: 'Agent-Onboarding', sections: ['## Der Lauf als Schleife', '## 5 · Prioritäten prüfen und nächstes freies Issue claimen', '## 7 · Umsetzungs-Kommentar für den Maintainer-Review', '## Referenzen'] },
  { path: 'docs/CI.md', title: 'CI', sections: ['## Required Gates', '## Zustände', '## Workflows', '## Nachweise'] },
  { path: 'docs/GOVERNANCE.md', title: 'Governance', sections: ['## Rollen und Lanes', '## Claims', '## Eskalation', '## Branch-Schutz'] },
  { path: 'docs/TESTING.md', title: 'Testing', sections: ['### Die eine Testlinie', '## Testmatrix', '## Zusatzregressionen'] },
  { path: 'docs/INDEX.md', title: 'Doku-Index', sections: ['## Einstieg', '## Referenzen', '## Pflichtdokumente', '## Verträge'] },
  { path: 'docs/contracts/README.md', title: 'Vertragsindex', sections: ['## Verträge', '## Schreibregeln'] },
  { path: 'AGENTS.md', title: 'Agentenvertrag', sections: ['## Zehn unverhandelbare Regeln', '## Zustand', '## Befehle', '## Referenzen'] },
]);

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
  problems.push(...inventoryProblems());
  return problems;
}
