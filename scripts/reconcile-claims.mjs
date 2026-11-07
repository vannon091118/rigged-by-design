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
 * Aufruf: `node scripts/reconcile-claims.mjs [--apply] [--json] [--check]`
 * Ohne `--apply` wird nur berichtet; mit `--apply` wird das Register atomar
 * ueber `saveClaims` geschrieben, inklusive Belegart und Beleg-Commit. Exit 1
 * nur mit `--check` und offener Abweichung oder unbelegtem Befund.
 */
import { execFileSync } from 'node:child_process';
import { commitOnMain, decideClaim, localMergeEvidence, mergedPullRequestIndex } from './lib/claim-evidence.mjs';
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

const gitStrict = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const remoteHead = (branch) => {
  const out = git(['ls-remote', '--heads', 'origin', branch]);
  if (out === null) return { known: false, sha: null };
  const sha = out.split(/\s+/)[0] ?? '';
  return { known: true, sha: sha || null };
};

const claims = loadClaimsStrict();
const mergedIndex = mergedPullRequestIndex();
const baseTip = git(['rev-parse', 'origin/main']);
const changes = [];
const unresolved = [];

for (const claim of claims.filter((entry) => entry.status === 'open')) {
  const { known, sha } = remoteHead(claim.branch);
  // Der lokale Beleg steht auch dann zur Verfuegung, wenn der Branch am Remote
  // schon geloescht ist - genau der Zustand nach einem Squash-Merge.
  const local = localMergeEvidence({ branch: claim.branch });
  const mergedPr = mergedIndex?.get(claim.branch) ?? null;
  const branchAtBase = local.atBase || Boolean(sha && baseTip && sha === baseTip);
  const branchExists = sha !== null || local.headSha !== null;
  const mergedOnMain = Boolean(
    mergedPr &&
      (branchExists ? branchAtBase : known) &&
      commitOnMain({ sha: mergedPr.mergeCommit ?? mergedPr.headRefOid, git: gitStrict }),
  );
  const evidence = decideClaim({
    branchExists,
    branchAtBase,
    branchHeadOnMain: local.headOnMain,
    branchTreeOnMain: local.treeOnMain,
    headSha: local.headSha ?? sha,
    mergedPr,
    mergedOnMain,
  });
  if (evidence.status) {
    const shaForProof =
      evidence.evidence === 'merged-pr'
        ? (mergedPr?.mergeCommit ?? mergedPr?.headRefOid ?? null)
        : evidence.evidence === 'branch-tree-on-main'
          ? local.treeOnMain
          : local.headSha;
    changes.push({
      claim,
      status: evidence.status,
      why: evidence.why,
      evidence: evidence.evidence,
      sha: shaForProof ?? null,
    });
    continue;
  }
  // Kein Beleg ist ein Befund, keine stille Einstufung: der Claim bleibt, wie
  // er ist, und wird gemeldet.
  if (!known) unresolved.push({ id: claim.id, why: 'Remote nicht erreichbar, kein lokaler Beleg' });
  else if (sha === null && local.headSha === null) unresolved.push({ id: claim.id, why: evidence.why });
}

if (changes.length === 0 && unresolved.length === 0) {
  console.log('reconcile-claims: keine Abweichung');
  process.exit(0);
}

for (const change of changes) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.claim.id} -> ${change.status} (${change.why})`);
  change.claim.status = change.status;
  change.claim.mergedEvidence = change.evidence;
  change.claim.mergedSha = change.sha;
}
for (const entry of unresolved) console.log(`unbelegt: ${entry.id} (${entry.why})`);

if (json) {
  process.stdout.write(
    `${JSON.stringify(
      {
        changes: changes.map((c) => ({ id: c.claim.id, status: c.status, evidence: c.evidence, sha: c.sha, why: c.why })),
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
