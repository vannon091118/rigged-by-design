#!/usr/bin/env node
/** Doc-Gate: Struktur, Marker und flacher Wurzelbaum; rot bei Abweichung. */
import { verifyDocs } from './lib/doc-sync.mjs';
import { describePlan, plan } from './lib/escalation.mjs';
import { fail } from './lib/report.mjs';

const problems = verifyDocs();
if (problems.length === 0) {
  console.log('verify:docs: PASS');
  process.exit(0);
}
problems.forEach((problem, index) => fail(index + 1, 'ERR-4017', 'verify:docs', problem));
console.error(describePlan(plan(problems.join('\n'))));
process.exit(1);
