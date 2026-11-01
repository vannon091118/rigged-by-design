/**
 * Pflichtdoku: eine Liste, ein Marker, eine Pruefung.
 *
 * Der Marker traegt Version und Zeitstempel; der Pre-Commit-Hook schreibt ihn,
 * `verify:docs` prueft ihn und die Pflichtabschnitte. Kein Gate schreibt hier.
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
  { path: 'AGENTS.md', title: 'Agentenvertrag', sections: ['## Build & test', '## Delivery', '## Pflichtdoku'] },
]);

const MARKER = /<!-- rbd-doc: v([^ |]+) \| ([^>]+?) -->/;
const MAX_AGE_MS = 72 * 60 * 60 * 1000;
const ROOT_DOCS = new Set(['README.md', 'AGENTS.md']);

export function markerOf(text) {
  const match = MARKER.exec(text);
  return match ? { version: match[1], stamp: match[2] } : null;
}

export function applyMarker(text, version, stamp) {
  const line = `<!-- rbd-doc: v${version} | ${stamp} -->`;
  if (MARKER.test(text)) return text.replace(MARKER, line);
  const lines = text.split('\n');
  lines.splice(1, 0, '', line);
  return lines.join('\n');
}

/** Schreibt den Marker in jedes Pflichtdokument; gibt die geaenderten Pfade zurueck. */
export function syncDocs(version, stamp) {
  const changed = [];
  for (const doc of DOC_SET) {
    const file = join(ROOT, doc.path);
    if (!existsSync(file)) continue;
    const next = applyMarker(readFileSync(file, 'utf8'), version, stamp);
    const before = readFileSync(file, 'utf8');
    if (next !== before) {
      writeFileSync(file, next);
      changed.push(doc.path);
    }
  }
  return changed;
}

function stampAge(stamp) {
  const parsed = Date.parse(`${stamp.slice(0, 16).replace(' ', 'T')}:00Z`);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : Date.now() - parsed;
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
    if (!marker) problems.push(`${doc.path}: rbd-doc-Marker mit Version und Zeitstempel fehlt.`);
    else if (stampAge(marker.stamp) > MAX_AGE_MS) {
      problems.push(`${doc.path}: Zeitstempel ${marker.stamp} ist aelter als 72 Stunden.`);
    }
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
