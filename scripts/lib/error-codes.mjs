/**
 * Fehlercodes fuer die Gate-Skripte.
 *
 * Quelle ist das Register selbst (`src/core/governance/error-codes.ts`), das
 * auch Tests und Reporter lesen. Der Markdown-Katalog bleibt Dokumentation und
 * ist nicht mehr Pruefgrundlage: ein Code, der im Register steht, ist bekannt –
 * auch dann, wenn jemand vergisst, die Tabelle nachzuziehen. Genau dieser
 * Zustand hat ERR-1001 unsichtbar in ERR-0000 verwandelt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCE = join(ROOT, 'src', 'core', 'governance', 'error-codes.ts');
const ENTRY = /code:\s*'(ERR-\d{4})'[^}]*?level:\s*'([A-Z_]+)'[^}]*?area:\s*'([^']*)'[^}]*?cause:\s*'([^']*)'[^}]*?fix:\s*'([^']*)'/g;

function readRegistry() {
  const source = readFileSync(SOURCE, 'utf8');
  const entries = [...source.matchAll(ENTRY)];
  return entries.map(([, code, level, area, cause, fix]) => {
    const line = source.split(/\r?\n/).find((entry) => entry.includes(`code: '${code}'`)) ?? '';
    const scope = /scope:\s*'(lane|project|triage|advisory)'/.exec(line)?.[1]
      ?? (level === 'BLOCKED' ? 'lane' : level === 'REMOTE_CI' ? 'project' : 'advisory');
    return Object.freeze({ code, level, scope, area, cause, fix });
  });
}

/** Register als Map: Code -> Definition. */
export const CATALOG = new Map(readRegistry().map((entry) => [entry.code, entry]));

/** Alle registrierten Codes; ein unbekannter Code ist ERR-0000. */
export function catalogCodes() {
  return new Set(CATALOG.keys());
}

export function isKnownCode(code) {
  return CATALOG.has(code);
}
