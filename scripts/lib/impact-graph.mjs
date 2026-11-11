/**
 * Die Grenze des Impact-Pfads: Er laeuft in einem nackten Checkout ohne
 * `node_modules`. Ein TypeScript-Compiler oder `ts-ast.mjs` in seiner
 * transitiven Importmenge wuerde `agent:context`, `pretask` und
 * `test:affected` mit "Impact-Plan fehlt" blockieren.
 *
 * Geprueft wird die echte Importmenge, nicht eine Liste: neue Module duerfen
 * hinzukommen, solange sie ohne Compiler auskommen. Die Kanten liest
 * `imports.mjs` (Specifier per Muster), damit das Gate selbst ohne TypeScript
 * laeuft. Ein relativer Import, der nicht aufgeloest wird, zaehlt nicht als
 * Kante; ein Paketimport kann die Grenze nur ueber die Verbotsliste brechen.
 */
import { relative, resolve } from 'node:path';
import { resolveSpecifier, specifiersOf } from './imports.mjs';
import { ROOT } from './report.mjs';

/** Die Einstiege, deren Importmenge ohne `node_modules` laufen muss. */
export const IMPACT_ENTRY_POINTS = Object.freeze([
  'scripts/lib/impact.mjs',
  'scripts/lib/affected-tests.mjs',
]);

/** Alles, was den Compiler statisch nachlaedt. */
export const FORBIDDEN_SPECIFIERS = Object.freeze([
  Object.freeze({ pattern: /^typescript(\/|$)/, reason: 'TypeScript-Compiler' }),
  Object.freeze({ pattern: /(^|\/)ts-ast\.mjs$/, reason: 'ts-ast-Wrapper (laedt den Compiler)' }),
]);

const normalize = (file) => file.replaceAll('\\', '/');

/**
 * Transitive Importmenge der Einstiege und jeder verbotene Specifier darin.
 * `specifiersOf` und `resolveSpecifier` sind fuer den Test injizierbar; im
 * Betrieb sind es die leichten Leser aus `imports.mjs`.
 */
export function auditImpactGraph(options = {}) {
  const root = options.root ?? ROOT;
  const entries = options.entries ?? IMPACT_ENTRY_POINTS;
  const readSpecifiers = options.specifiersOf ?? specifiersOf;
  const resolveFrom = options.resolveSpecifier ?? resolveSpecifier;
  const modules = new Set();
  const violations = [];
  const queue = [...entries];

  while (queue.length > 0) {
    const file = queue.pop();
    if (modules.has(file)) continue;
    modules.add(file);
    for (const specifier of readSpecifiers(resolve(root, file))) {
      const forbidden = FORBIDDEN_SPECIFIERS.find((entry) => entry.pattern.test(specifier));
      if (forbidden) {
        violations.push({ file, specifier, reason: forbidden.reason });
        continue;
      }
      const resolved = resolveFrom(specifier, resolve(root, file));
      if (resolved) queue.push(normalize(relative(root, resolved)));
    }
  }

  return { ok: violations.length === 0, modules: [...modules].sort(), violations };
}
