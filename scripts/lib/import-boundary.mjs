/**
 * Importgrenze der generierten Narrativ-Registry.
 *
 * `registry.generated.ts` ist Implementierungsdetail des Composers: die Datei
 * wird vom Compiler erzeugt und aendert sich mit jedem Narrativ-Beitrag. Wird
 * sie direkt importiert, haengt jedes dieser Module transitiv an der ganzen
 * Registry - und damit an fast jedem Test.
 *
 * Deshalb liest nur `composer/index.ts` die Datei; alles andere bezieht die
 * Fragmente ueber `NARRATIVE_FRAGMENTS`. Diese Pruefung ist die eine Regel
 * dafuer; `verify:tree` macht sie fail-closed.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { ROOT } from './report.mjs';

export const REGISTRY_FILE = 'src/core/sim/narrative/composer/registry.generated.ts';
export const REGISTRY_SURFACE = 'src/core/sim/narrative/composer/index.ts';

const CODE = /\.(ts|tsx)$/;
const SPECIFIER = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
const norm = (file) => file.split(sep).join('/');
const withoutExt = (file) => file.replace(/\.(ts|tsx)$/, '');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CODE.test(entry.name)) out.push(full);
  }
  return out;
}

/** Alle relativen Registry-Importe einer Datei, unaufgeloest. */
export function registrySpecifiersIn(text) {
  return [...text.matchAll(SPECIFIER)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.') && /(^|\/)registry\.generated$/.test(specifier));
}

/**
 * Jeder Import von `registry.generated` ausserhalb der Composer-Fassade ist ein
 * Verstoss - auch in Tests und Fixtures. Rueckgabe ist stabil und leer, wenn
 * `src/` fehlt.
 */
export function auditRegistryBoundary({ root = ROOT, files = null } = {}) {
  const src = join(root, 'src');
  const scanned = files ?? (existsSync(src) ? walk(src) : []);
  const target = withoutExt(norm(REGISTRY_FILE));
  const surface = norm(REGISTRY_SURFACE);
  const violations = [];
  for (const file of scanned) {
    const rel = norm(relative(root, file));
    if (rel === surface) continue;
    const text = readFileSync(file, 'utf8');
    for (const specifier of registrySpecifiersIn(text)) {
      const resolved = withoutExt(norm(relative(root, resolve(dirname(file), specifier))));
      if (resolved !== target) continue;
      violations.push({ file: rel, specifier });
    }
  }
  return { ok: violations.length === 0, violations, scanned: scanned.length };
}

