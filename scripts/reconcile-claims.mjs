#!/usr/bin/env node
/**
 * Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen.
 *
 * Ein Claim auf einen geloeschten Branch oder ein bereits gemergter Stand ist
 * keine Sperre, sondern eine Luege im Register. Dieses Skript gleicht die
 * offenen Claims einmal idempotent ab:
 *
 * - Branch existiert nicht mehr und der Kopf liegt auf `origin/main` -> `merged`
 * - Branch existiert nicht mehr und der Kopf ist nicht auf main -> `superseded`
 *   (nichts wird geloescht; der Befund bleibt sichtbar)
 * - Branch existiert und ist vollstaendig in main enthalten -> `merged`
 *
 * Aufruf: `node scripts/reconcile-claims.mjs [--apply] [--json]`
 * Ohne `--apply` wird nur berichtet; mit `--apply` wird das Register atomar
 * ueber `saveClaims` geschrieben. Exit 1 nur mit `--check` und offener Abweichung.
 */
import { execFileSync } from 'node:child_process';
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
const changes = [];
for (const claim of claims.filter((entry) => entry.status === 'open')) {
  const { known, sha } = remoteHead(claim.branch);
  if (!known) continue; // Remote nicht erreichbar: nichts behaupten.
  const tip = sha ?? claim.baseSha;
  if (sha === null) {
    changes.push({ claim, status: onMain(tip) ? 'merged' : 'superseded', why: 'Branch existiert nicht mehr' });
    continue;
  }
  if (onMain(sha)) changes.push({ claim, status: 'merged', why: 'Branch ist vollstaendig in main' });
}

if (changes.length === 0) {
  console.log('reconcile-claims: keine Abweichung');
  process.exit(0);
}

for (const change of changes) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.claim.id} -> ${change.status} (${change.why})`);
  change.claim.status = change.status;
}
if (json) process.stdout.write(`${JSON.stringify(changes.map((change) => ({ id: change.claim.id, status: change.status, why: change.why })), null, 2)}\n`);
if (apply) {
  saveClaims(claims);
  console.log(`reconcile-claims: ${changes.length} Claim(s) aktualisiert`);
}
if (check && !apply) process.exit(1);
