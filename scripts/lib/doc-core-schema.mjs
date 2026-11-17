/**
 * Der Doku-Vertrag: fuenf Pflichtdokus in `docs/governance/`, zwei Einstiege,
 * ein Token-Budget. Reine Konstanten und Lese-Helfer; die Pruefungen liegen in
 * eigenen Modulen.
 *
 * Gemessen wird mit einem echten Tokenizer (`gpt-tokenizer`, o200k_base), nicht
 * mit einer Zeichen-Naeherung: das Budget soll die Kontextkosten abbilden, die
 * ein Modell tatsaechlich zahlt.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode } from 'gpt-tokenizer';

export const CORE_TOKEN_BUDGET = 500;
export const OVERVIEW_TOKEN_BUDGET = 10_000;
export const TOKENIZER = 'gpt-tokenizer/o200k_base';

export const CORE_DOCS = Object.freeze([
  {
    path: 'docs/governance/AGENTS.md',
    title: 'Agentenvertrag',
    scope: 'document',
    sections: ['## Kern', '## Zehn Regeln', '## Ablauf', '## Referenzen'],
  },
  {
    path: 'docs/governance/PITFALLS.md',
    title: 'Pitfalls',
    scope: 'document',
    sections: ['## Kern', '## Fallen', '## Doku-Regeln'],
  },
  {
    path: 'docs/governance/INDEX.md',
    title: 'Doku-Index',
    scope: 'document',
    sections: ['## Kern', '## Pflichtdokus', '## Referenzen', '## Ordner'],
  },
  {
    path: 'docs/governance/ROADMAP.md',
    title: 'Roadmap',
    scope: 'document',
    sections: ['## Kern', '## Major-Ziele', '## Minor-Ziele', '## Jetzt', '## Als Naechstes', '## Spaeter'],
  },
  {
    path: 'docs/governance/LAST-CHANGES.md',
    title: 'Last Changes',
    scope: 'document',
    sections: ['## Kern', '## Letzte Änderungen', '## Regeln'],
  },
]);

export const CORE_PATHS = Object.freeze(CORE_DOCS.map((doc) => doc.path));

export const ENTRY_DOCS = Object.freeze([
  { path: 'docs/TESTING.md', title: 'Test-Kern', scope: 'kern', sections: ['## Kern'] },
  { path: 'docs/GOVERNANCE.md', title: 'Governance-Kern', scope: 'kern', sections: ['## Kern'] },
]);

export const READING_DOCS = Object.freeze([...CORE_DOCS, ...ENTRY_DOCS]);
export const READING_PATHS = Object.freeze(READING_DOCS.map((doc) => doc.path));
export const READING_TOKEN_BUDGET = OVERVIEW_TOKEN_BUDGET;

const tokenCache = new Map();

/** Echte Tokenzahl aus dem Tokenizer; derselbe Text wird nur einmal kodiert. */
export function countTokens(text) {
  const value = String(text ?? '').replaceAll('\r\n', '\n');
  const cached = tokenCache.get(value);
  if (cached !== undefined) return cached;
  const count = encode(value).length;
  tokenCache.set(value, count);
  return count;
}

/** Inhalt zwischen `## Kern` und der naechsten Ueberschrift. */
export function kernBlock(text) {
  const value = String(text ?? '').replaceAll('\r\n', '\n');
  const heading = /^## Kern\s*$/m.exec(value);
  if (!heading) return null;
  const rest = value.slice(heading.index + heading[0].length);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Der budgetierte Teil eines Dokuments: ganze Datei oder nur der Kern. */
export function budgetedText(doc, text) {
  return doc.scope === 'document' ? String(text ?? '') : kernBlock(text);
}

export function readText(path, root = process.cwd()) {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

export function trackedFiles(root) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function packageScripts(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  } catch {
    return {};
  }
}
