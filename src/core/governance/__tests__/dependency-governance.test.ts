/** @test-target: src/core/governance/error-codes.ts | @error-code: ERR-4007 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, formatError } from '../error-codes';

const ROOT = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const declared = new Set([...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})]);
const architecture = readFileSync(resolve(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8');
const section = architecture.split('<!-- DEP_MATRIX_START -->')[1]?.split('<!-- DEP_MATRIX_END -->')[0] ?? '';
const rows = section.split(/\r?\n/).filter((line) => line.startsWith('| ')).slice(2);

const pkgRoot = (specifier: string): string => specifier.startsWith('@')
  ? specifier.split('/').slice(0, 2).join('/')
  : specifier.split('/')[0]!;

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const imported = new Set<string>();
for (const file of walk(resolve(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1]!;
    if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
    imported.add(pkgRoot(specifier));
  }
}

describe('Dependency-Governance', () => {
  it('dokumentiert jede Dependency mit Begruendung und realer Nutzung', () => {
    const table = new Map<string, string[]>();
    for (const row of rows) {
      const cells = row.split('|').map((cell) => cell.trim());
      table.set(cells[1] ?? '', cells);
    }
    for (const pkg of declared) {
      const cells = table.get(pkg);
      expect(table.has(pkg), `${pkg} fehlt in ARCHITECTURE.md`).toBe(true);
      expect((cells?.[4] ?? '').length, `${pkg} ohne Begruendung`).toBeGreaterThan(10);
      expect(Number.parseInt(cells?.[5] ?? '0', 10), `${pkg} ohne Nutzung`).toBeGreaterThan(0);
    }
    expect(table.size).toBe(declared.size);
  });

  it('importiert keine undokumentierte Dependency aus src', () => {
    const undocumented = [...imported].filter((pkg) => !declared.has(pkg));
    expect(undocumented).toEqual([]);
    expect(imported.size).toBeGreaterThan(0);
  });

  it('blockiert unbekannte und leere Fehlercodes als ERR-0000', () => {
    expect(() => formatError(1, 'ERR-9999', 'test', 'unbekannt')).toThrow(/ERR-0000/);
    expect(() => formatError(1, 'ERR-0000', 'test', 'unbekannt')).toThrow(/ERR-0000/);
    expect(formatError(2, 'ERR-4001', 'test', 'bekannt')).toContain('[ERR-4001]');
  });

  it('haelt Fehlerregister und Katalog deckungsgleich', () => {
    const tsCodes = new Set<string>(Object.values(ERROR_CODES).map((entry) => entry.code));
    const catalog = readFileSync(resolve(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8');
    const catalogCodes = new Set([...catalog.matchAll(/^\|\s*(ERR-\d{4})\s*\|/gm)].map((match) => match[1] ?? ''));
    expect([...tsCodes].filter((code) => !catalogCodes.has(code))).toEqual([]);
    expect([...catalogCodes].filter((code) => !tsCodes.has(code))).toEqual([]);
  });

});
