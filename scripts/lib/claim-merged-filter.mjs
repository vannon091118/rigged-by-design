/**
 * Kollisionen gegen belegte Merges filtern: eine Lane, deren Arbeit
 * nachweislich auf `main` steht, ist keine Sperre mehr. Ohne jeden Nachweis
 * bleibt es fail-closed bei der Kollision.
 */
import { execFileSync } from 'node:child_process';
import { MERGED_INDEX_PATH } from './merged-index.mjs';
import { commitOnMain, decideClaim, localMergeEvidence } from './claim-evidence.mjs';
import { mergedPullRequestGroups, mergedPullRequestIndex } from './claim-pr-index.mjs';

const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const defaultGh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function filterMergedCollisions({
  collisions = [],
  claims = [],
  baseRef = 'origin/main',
  git = defaultGit,
  gh = defaultGh,
  onMerged = null,
  prIndex,
  prGroups,
  root,
  mergedIndexFile = MERGED_INDEX_PATH,
  mergedIndexData,
} = {}) {
  const mergedIndex = prIndex === undefined
    ? mergedPullRequestIndex({ gh, baseRef: 'main', root, file: mergedIndexFile, indexData: mergedIndexData })
    : prIndex;
  // Mehrdeutige Branch-Namen (ein Name, mehrere gemergte PRs) bleiben fuer die
  // Identitaet unbrauchbar, taugen aber als Merge-Beleg: Wenn jede Fassung des
  // Branches auf `main` liegt, ist die Arbeit gemergt, egal welche davon der
  // Claim meinte. Genau dieser Fall blockierte Lane-Pfade dauerhaft.
  const mergedGroups = prGroups === undefined && prIndex === undefined
    ? mergedPullRequestGroups({ gh, baseRef: 'main', root, file: mergedIndexFile, indexData: mergedIndexData })
    : prGroups ?? null;
  let baseTip = null;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    baseTip = null;
  }
  const remoteHead = (branch) => {
    try {
      const out = git(['ls-remote', '--heads', 'origin', branch]);
      return { known: true, sha: String(out ?? '').split(/\s+/)[0] || null };
    } catch {
      return { known: false, sha: null };
    }
  };
  return collisions.filter((collision) => {
    const other = claims.find((entry) => entry.id === collision.lane);
    if (!other) return true;
    const pr = mergedIndex?.get(other.branch) ?? null;
    const group = mergedGroups?.get(other.branch) ?? null;
    const local = localMergeEvidence({ branch: other.branch, baseRef, git });
    const remote = local.headSha ? { known: true, sha: null } : remoteHead(other.branch);
    const branchHead = local.headSha ?? remote.sha;
    const branchExists = Boolean(branchHead);
    const branchAtBase =
      local.atBase ||
      Boolean(other.baseSha && branchHead === other.baseSha) ||
      Boolean(remote.sha && baseTip && remote.sha === baseTip);
    // Ein fehlender Branch ist nur dann belegt, wenn `ls-remote` erfolgreich war.
    // Ein Netzfehler bleibt fail-closed und laesst die Kollision stehen.
    const absenceKnown = !branchExists && remote.known;
    const allGroupMergesOnMain = Boolean(
      !pr && group && group.length > 1 && !branchExists && absenceKnown &&
        group.every((entry) => commitOnMain({ sha: entry.mergeCommit ?? entry.headRefOid, baseRef, git })),
    );
    const mergedOnMain = allGroupMergesOnMain || Boolean(
      pr &&
        (branchExists ? branchAtBase : absenceKnown) &&
        commitOnMain({ sha: pr.mergeCommit ?? pr.headRefOid, baseRef, git }),
    );
    const evidence = decideClaim({
      branchExists,
      branchAtBase,
      branchHeadOnMain: local.headOnMain,
      branchTreeOnMain: local.treeOnMain,
      headSha: branchHead,
      mergedPr: pr ?? (allGroupMergesOnMain ? group?.[0] ?? null : null),
      mergedOnMain,
    });
    if (evidence.status === 'merged') {
      if (typeof onMerged === 'function') onMerged(collision, evidence);
      return false;
    }
    return true;
  });
}
