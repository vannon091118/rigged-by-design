#!/usr/bin/env node
/**
 * Die Gate-Matrix fuer GitHub Actions.
 *
 * Ein Gate, ein Job, ein Status: ein roter Lauf nennt damit das Gate beim
 * Namen, statt "verify:all ist rot" zu melden. Die Liste kommt aus
 * `pipeline-plan`; ohne diese gemeinsame Quelle waere die CI eine zweite
 * Wahrheit neben `verify`.
 *
 * Ausgabe (eine Zeile, direkt fuer $GITHUB_OUTPUT):
 *   {"include":[{"gate":"lint"},{"gate":"typecheck"}]}
 *
 * Aufruf: `node scripts/gate-matrix.mjs --profile=all|light|quick|release`
 */
import { auditRequired } from './lib/dependency-change.mjs';
import { GATES, isProfile, normalizeProfile, planGates, PROFILES } from './lib/pipeline-plan.mjs';

const arg = (name) => {
  const hit = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const profile = normalizeProfile(arg('profile') ?? 'full');
if (!isProfile(profile)) {
  console.error(`gate-matrix: unbekanntes Profil '${profile}'; erlaubt sind ${PROFILES.join(', ')}`);
  process.exit(1);
}

const planned = planGates(profile) ?? [];
// `audit` braucht die Registry. Es steht nur in der Matrix, wenn sich
// Abhaengigkeiten wirklich geaendert haben oder RBD_VERIFY_AUDIT=1 es erzwingt.
const includeAudit = auditRequired();
const keys = planned.filter((key) => key !== 'audit' || includeAudit);
const skipped = planned.filter((key) => !keys.includes(key));

for (const key of skipped) {
  console.error(`[skipped] ${key}: keine Dependency-Aenderung (RBD_VERIFY_AUDIT=1 erzwingt das Audit)`);
}
if (keys.length === 0) {
  // Eine leere Matrix waere ein stiller Freischein: kein Job, kein Status, gruen.
  console.error('gate-matrix: leerer Gate-Plan; das waere ein Freischein statt einer Pruefung');
  process.exit(1);
}

process.stdout.write(JSON.stringify({ include: keys.map((key) => ({ gate: GATES[key].name })) }));
