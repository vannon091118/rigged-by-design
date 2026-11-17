/**
 * Lesender Reconcile-Plan fuer offene Claims.
 *
 * Schreibt nichts; `reconcile-claims --apply` bleibt der einzige Schreiber.
 * Ein einzelner `ls-remote` ersetzt die Abfrage pro Branch.
 */
import { execFileSync } from 'node:child_process';
import { commitOnMain, decideClaim, localMergeEvidence } from './claim-evidence.mjs';
import { mergedPullRequestIndex, remoteHeads } from './claim-pr-index.mjs';
import { MERGED_INDEX_PATH } from './merged-index.mjs';

export { remoteHeads } from './claim-pr-index.mjs';

const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const LIFECYCLE_EVIDENCE = Object.freeze({
  'merged-pr': 'merged-pr',
  'branch-head-on-main': 'head-on-main',
  'branch-tree-on-main': 'tree-on-main',
});

export function planReconcile({
  claims = [],
  baseRef = 'origin/main',
  git = defaultGit,
  gh,
  prIndex,
  root,
  mergedIndexFile = MERGED_INDEX_PATH,
  mergedIndexData,
} = {}) {
  const mergedIndex = prIndex === undefined
    ? mergedPullRequestIndex({ gh, baseRef: 'main', root, file: mergedIndexFile, indexData: mergedIndexData })
    : prIndex;
  const heads = remoteHeads({ git });
  let baseTip;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    baseTip = null;
  }
  const changes = [];
  const unresolved = [];
  for (const claim of claims.filter((item) => item?.status === 'open')) {
    const local = localMergeEvidence({ branch: claim.branch, baseRef, git });
    const remoteSha = heads?.get(claim.branch) ?? null;
    const mergedPr = mergedIndex?.get(claim.branch) ?? null;
    const branchExists = remoteSha !== null || local.headSha !== null;
    const branchAtBase =
      local.atBase ||
      Boolean(claim.baseSha && (local.headSha ?? remoteSha) === claim.baseSha) ||
      Boolean(remoteSha && baseTip && remoteSha === baseTip);
    const absenceKnown = !branchExists && heads !== null;
    const mergedOnMain = Boolean(
      mergedPr &&
        (branchExists ? branchAtBase : absenceKnown) &&
        commitOnMain({ sha: mergedPr.mergeCommit ?? mergedPr.headRefOid, baseRef, git }),
    );
    const evidence = decideClaim({
      branchExists,
      branchAtBase,
      branchHeadOnMain: local.headOnMain,
      branchTreeOnMain: local.treeOnMain,
      headSha: local.headSha ?? remoteSha,
      mergedPr,
      mergedOnMain,
    });
    if (evidence.status) {
      const sha =
        evidence.evidence === 'merged-pr'
          ? (mergedPr?.mergeCommit ?? mergedPr?.headRefOid ?? null)
          : evidence.evidence === 'branch-tree-on-main'
            ? local.treeOnMain
            : (local.headSha ?? remoteSha);
      const branchCleanup = branchExists
        ? { state: 'pending', evidence: 'remote-branch-present' }
        : heads === null
          ? { state: 'unknown', evidence: 'remote-heads-unreadable' }
          : { state: 'done', evidence: 'remote-branch-absent' };
      const pr = evidence.evidence === 'merged-pr' && mergedPr
        ? {
            number: mergedPr.number,
            url: mergedPr.url ?? null,
            state: 'merged',
            headSha: mergedPr.headRefOid ?? null,
            mergedSha: sha ?? null,
          }
        : null;
      changes.push({
        id: claim.id,
        branch: claim.branch,
        status: evidence.status,
        evidence: LIFECYCLE_EVIDENCE[evidence.evidence] ?? evidence.evidence,
        sha: sha ?? null,
        why: evidence.why,
        branchExists,
        branchCleanup,
        pr,
        claim,
      });
      continue;
    }
    if (heads === null) unresolved.push({ id: claim.id, why: 'Remote nicht erreichbar, kein lokaler Beleg' });
    else if (!branchExists) unresolved.push({ id: claim.id, why: evidence.why });
  }
  return { changes, unresolved, prIndex: mergedIndex, remoteHeads: heads };
}
