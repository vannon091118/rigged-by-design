#!/usr/bin/env node
/**
 * Plan-Gate fuer den PR-Body. Der Body kommt als Umgebungsvariable, nie als
 * interpolierte Shell-Zeile; der Check schreibt nichts und legt kein Issue an.
 */
import { checkPrBody, PR_BODY_SECTIONS } from './lib/pr-body.mjs';

const body = process.env.PR_BODY ?? '';
const result = checkPrBody(body);
if (result.ok) {
  console.log('verify-pr-body: PASS (drei Pflichtsektionen mit Inhalt)');
  process.exit(0);
}
console.error('verify-pr-body: PR-Body unvollstaendig.');
if (result.missing.length > 0) {
  console.error(`  fehlt: ${result.missing.join(', ')}`);
}
if (result.empty.length > 0) {
  console.error(`  leer: ${result.empty.join(', ')}`);
}
console.error('  Pflicht:');
for (const section of PR_BODY_SECTIONS) console.error(`  ${section}`);
process.exit(1);
