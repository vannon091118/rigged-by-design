/** Einheitliches [IDX] [ERR] Format fuer alle Gate-Skripte. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CATALOG = join(ROOT, 'docs', 'ERROR_CATALOG.md');

export function catalogCodes() {
  if (!existsSync(CATALOG)) return new Set();
  const text = readFileSync(CATALOG, 'utf8');
  return new Set([...text.matchAll(/ERR-\d{4}/g)].map((match) => match[0]));
}

export function line(index, code, component, message) {
  const known = catalogCodes();
  const resolved = known.has(code) ? code : 'ERR-0000';
  const reason = resolved === 'ERR-0000' && code !== 'ERR-0000' ? ` (Code ${code} fehlt im Katalog)` : '';
  process.exitCode = 1;
  return `[IDX-${String(index).padStart(4, '0')}] [${resolved}] ${component}: ${message}${reason}`;
}

export function fail(index, code, component, message) {
  console.error(line(index, code, component, message));
  return 1;
}

export function autofixLine(index, component, message) {
  return `[IDX-${String(index).padStart(4, '0')}] [ERR-0911-AUTOFIXED] ${component}: ${message}`;
}

export function walk(dir, predicate) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, predicate));
    else if (predicate(full)) found.push(full);
  }
  return found;
}
