/**
 * Der Doku-Vertrag: fuenf Pflichtdokus, zwei Einstiege, ein Token-Budget.
 * Reine Konstanten und Lese-Helfer; die Pruefungen liegen in eigenen Modulen.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CHARS_PER_TOKEN = 4;
export const CORE_TOKEN_BUDGET = 500;
export const OVERVIEW_TOKEN_BUDGET = 10_000;

export const CORE_DOCS = Object.freeze([
  {
    path: 'AGENTS.md',
    title: 'Agentenvertrag',
    scope: 'document',
    sections: ['## Kern', '## Zehn unverhandelbare Regeln', '## Pitfalls', '## Referenzen'],
  },
  {
    path: 'docs/WORKFLOW.md',
    title: 'Workflow',
    scope: 'document',
    sections: ['## Kern', '## Ablauf', '## Abschluss', '## Referenzen'],
  },
  {
    path: 'docs/INDEX.md',
    title: 'Doku-Index',
    scope: 'document',
    sections: ['## Kern', '## Pflichtdokus', '## Referenzen', '## Ordner'],
  },
  {
    path: 'docs/ROADMAP.md',
    title: 'Roadmap',
    scope: 'kern',
    sections: ['## Kern', '## Major-Ziele', '## Minor-Ziele', '## Jetzt', '## Als Nächstes', '## Später'],
  },
  {
    path: 'docs/LAST-CHANGES.md',
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

/** Deterministische Naeherung; Budget, keine Messung am Tokenizer. */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').replaceAll('\r\n', '\n').length / CHARS_PER_TOKEN);
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
