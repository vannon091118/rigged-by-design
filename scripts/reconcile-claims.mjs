#!/usr/bin/env node
/**
 * Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen.
 *
 * Ein Claim auf einen geloeschten Branch oder ein bereits gemergter Stand ist
 * keine Sperre, sondern eine Luege im Register. Der Merge-Nachweis kommt aus
 * `scripts/lib/claim-evidence.mjs`: ein Branch-Kopf auf `main` oder ein
 * gemergter Pull Request. Ein Basis-SHA ist **kein** Nachweis - er liegt per
 * Definition auf `main` und wuerde jeden geloeschten Branch als gemergt
 * ausgeben.
 *
 * Aufruf: `node scripts/reconcile-claims.mjs [--apply] [--json] [--check]`
 * Ohne `--apply` wird nur berichtet; mit `--apply` wird das Register atomar
 * ueber `saveClaims` geschrieben. Exit 1 nur mit `--check` und offener
 * Abweichung oder unbelegtem Befund.
 */
import { execFileSync } from 'node:child_process';
import { decideClaim, mergedPullRequestIndex } from './lib/claim-evidence.mjs';
import { loadClaimsStrict, saveClaims } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const json = argv.includes('--json');
const check = argv.includes('--check');

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const remoteHead = (branch) => {
  const out = git(['ls-remote', '--heads', 'origin', branch]);
  if (out === null) return { known: false, sha: null };
  const sha = out.split(/\s+/)[0] ?? '';
  return { known: true, sha: sha || null };
};

const onMain = (sha) => sha !== null && git(['merge-base', '--is-ancestor', sha, 'origin/main']) !== null;

const claims = loadClaimsStrict();
const mergedPr = mergedPullRequestIndex();
const changes = [];
const unresolved = [];

for (const claim of claims.filter((entry) => entry.status === 'open')) {
  const { known, sha } = remoteHead(claim.branch);
  if (!known) {
    unresolved.push({ id: claim.id, why: 'Remote nicht erreichbar' });
    continue;
  }
  const evidence = decideClaim({
    branchExists: sha !== null,
    branchHeadOnMain: sha !== null && onMain(sha),
    mergedPr: mergedPr?.get(claim.branch) ?? null,
  });
  if (evidence.status) {
    changes.push({ claim, status: evidence.status, why: evidence.why });
    continue;
  }
  // Ein geloeschter Branch ohne Beleg ist ein offener Befund, keine stille
  // Einstufung: der Claim bleibt, wie er ist, und wird gemeldet.
  if (sha === null) unresolved.push({ id: claim.id, why: evidence.why });
}

if (changes.length === 0 && unresolved.length === 0) {
  console.log('reconcile-claims: keine Abweichung');
  process.exit(0);
}

for (const change of changes) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.claim.id} -> ${change.status} (${change.why})`);
  change.claim.status = change.status;
}
for (const entry of unresolved) console.log(`unbelegt: ${entry.id} (${entry.why})`);

if (json) {
  process.stdout.write(`${JSON.stringify({ changes: changes.map((c) => ({ id: c.claim.id, status: c.status, why: c.why })), unresolved }, null, 2)}\n`);
}
if (apply) {
  saveClaims(claims);
  console.log(`reconcile-claims: ${changes.length} Claim(s) aktualisiert`);
}
if (check && !apply) process.exit(1);
