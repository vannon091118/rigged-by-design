#!/usr/bin/env node
/**
 * Impact-Graph-Gate: Der Impact-Pfad darf keinen TypeScript-Compiler laden.
 *
 * `agent:context`, `pretask` und `test:affected` muessen in einem nackten
 * Checkout ohne `node_modules` laufen. Das Gate liest die transitive
 * Importmenge der Einstiege und meldet jeden `typescript`- oder
 * `ts-ast.mjs`-Import; es braucht selbst keinen Compiler.
 */
import { auditImpactGraph } from './lib/impact-graph.mjs';
import { fail } from './lib/report.mjs';

const json = process.argv.includes('--json');
const result = auditImpactGraph();
if (json) console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  result.violations.forEach((entry, index) => {
    fail(index + 1, 'ERR-4019', entry.file, `TypeScript-Import im Impact-Pfad: '${entry.specifier}' (${entry.reason}).`);
  });
  console.error(`verify-impact-graph: ${result.violations.length} Verstoss/Verstoesse`);
  process.exit(1);
}
if (!json) {
  console.log(`verify-impact-graph: PASS (${result.modules.length} Module im Impact-Pfad, kein TypeScript-Import)`);
}
