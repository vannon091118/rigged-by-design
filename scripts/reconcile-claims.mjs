#!/usr/bin/env node
/**
 * Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen.
 *
 * Ein Claim auf einen geloeschten Branch oder ein bereits gemergter Stand ist
 * keine Sperre, sondern eine Luege im Register. Der Merge-Nachweis kommt aus
 * `scripts/lib/claim-evidence.mjs`: gemergter PR, Branch-Kopf auf `main` oder
 * ein baumgleicher Commit auf `main` aus der lokalen Historie. Ein Basis-SHA
 * ist **kein** Nachweis - er liegt per Definition auf `main` und wuerde jeden
 * geloeschten Branch als gemergt ausgeben.
 *
 * Die Entscheidung selbst liegt in `planReconcile`; `pretask` ruft dieselbe
 * Funktion lesend auf. Geschrieben wird nur hier mit `--apply`.
 *
 * Aufruf: `node scripts/reconcile-claims.mjs [--apply] [--json] [--check]`
 * Ohne `--apply` wird nur berichtet; mit `--apply` wird das Register atomar
 * ueber `saveClaims` geschrieben, inklusive Belegart und Beleg-Commit. Exit 1
 * nur mit `--check` und offener Abweichung oder unbelegtem Befund.
 */
import { execFileSync } from 'node:child_process';
import { planReconcile } from './lib/claim-evidence.mjs';
import { loadClaimsStrict, saveClaims } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const json = argv.includes('--json');
const check = argv.includes('--check');

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const claims = loadClaimsStrict();
const { changes, unresolved } = planReconcile({ claims, git });

if (changes.length === 0 && unresolved.length === 0) {
  console.log('reconcile-claims: keine Abweichung');
  process.exit(0);
}

for (const change of changes) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.id} -> ${change.status} (${change.why})`);
  change.claim.status = change.status;
  change.claim.mergedEvidence = change.evidence;
  change.claim.mergedSha = change.sha;
}
for (const entry of unresolved) console.log(`unbelegt: ${entry.id} (${entry.why})`);

if (json) {
  process.stdout.write(
    `${JSON.stringify(
      {
        changes: changes.map((change) => ({
          id: change.id,
          status: change.status,
          evidence: change.evidence,
          sha: change.sha,
          why: change.why,
        })),
        unresolved,
      },
      null,
      2,
    )}\n`,
  );
}
if (apply) {
  saveClaims(claims);
  console.log(`reconcile-claims: ${changes.length} Claim(s) aktualisiert`);
}
if (check && !apply) process.exit(1);
