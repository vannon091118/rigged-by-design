/**
 * Befunde am Doku-Inhalt: volatile Kerne, unbekannte Quellen, Last Changes.
 * Keine Strukturpruefung; die liegt in `doc-core-structure.mjs`.
 */
import { findCommand } from './command-surface.mjs';
import { readText } from './doc-core-schema.mjs';

/** Volatiler Inhalt: Version, HEAD-SHA oder generierter Block im Kern. */
export function volatileFindings(text) {
  const findings = [];
  if (/\b0\.\d+\.\d+\b/.test(text)) findings.push('Versionsnummer');
  if (/\b[0-9a-f]{7,40}\b/.test(text)) findings.push('Commit-SHA');
  if (/<!--\s*(?:generated|inventory|test_catalog|rbd-doc:\s*v)/i.test(text)) findings.push('generierter Block');
  return findings;
}

/** Jede im Kern genannte Quelle muss existieren. */
export function commandFindings(text, { scripts = {}, fileExists = () => false } = {}) {
  const findings = [];
  for (const match of String(text).matchAll(/`pnpm run ([a-z][\w:-]+)/g)) {
    if (!Object.hasOwn(scripts, match[1])) findings.push(`pnpm run ${match[1]}`);
  }
  for (const match of String(text).matchAll(/`node (scripts\/[\w./-]+\.mjs)/g)) {
    if (!fileExists(match[1])) findings.push(`node ${match[1]}`);
  }
  for (const match of String(text).matchAll(/`(?:pnpm )?rbd ([a-z][\w-]*) ([a-z][\w-]*)`/g)) {
    if (!findCommand(match[1], match[2])) findings.push(`rbd ${match[1]} ${match[2]}`);
  }
  return findings;
}

const CHANGELOG_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;

/** Last Changes: 3-7 datierte Zeilen, neueste oben, nie aelter als das Changelog. */
export function lastChangesProblems({ root, text = null } = {}) {
  const value = text ?? readText('docs/LAST-CHANGES.md', root);
  if (value === null) return ['docs/LAST-CHANGES.md fehlt.'];
  const start = value.indexOf('## Letzte Änderungen');
  if (start < 0) return [];
  const rest = value.slice(start + '## Letzte Änderungen'.length);
  const next = /^##\s+/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  const dates = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const date = /^(\d{4}-\d{2}-\d{2})$/.exec(cells[0] ?? '');
    if (!date) continue;
    if (cells.length < 3 || cells[1] === '' || cells[2] === '') {
      return [`docs/LAST-CHANGES.md: Zeile ${date[1]} braucht Aenderung und Beleg.`];
    }
    dates.push(date[1]);
  }
  if (dates.length < 3 || dates.length > 7) {
    return [`docs/LAST-CHANGES.md: ${dates.length} Eintraege, erlaubt sind 3-7.`];
  }
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index] > dates[index - 1]) return ['docs/LAST-CHANGES.md: Eintraege nicht absteigend datiert.'];
  }
  const changelog = readText('docs/CHANGELOG.md', root) ?? '';
  const newest = [...changelog.matchAll(CHANGELOG_DATE)].map((match) => match[1]).sort().at(-1);
  if (newest && dates[0] < newest) {
    return [`docs/LAST-CHANGES.md: neuester Eintrag ${dates[0]} aelter als Changelog ${newest}.`];
  }
  return [];
}
