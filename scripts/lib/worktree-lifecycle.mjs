/**
 * Worker-Worktree-Lifecycle: Neuaufbau nur mit belegtem Merge.
 *
 * `DONE`, `REVIEW_PENDING`, ein geschlossener PR oder ein verschwundener
 * Remote-Branch sind kein Merge-Nachweis. Erst wenn GitHub `merged: true`
 * meldet, der Merge-SHA auf `origin/main` liegt, der lokale HEAD dem PR-HEAD
 * entspricht und der Baum keine ungesicherte Arbeit traegt, darf der alte
 * Worker-Worktree weichen. Alles andere haelt ihn am Leben.
 */

export const REBUILD_BLOCKERS = Object.freeze([
  'pr-missing',
  'pr-not-merged',
  'merge-sha-missing',
  'merge-sha-not-on-main',
  'local-head-diverged',
  'remote-head-diverged',
  'dirty-worktree',
  'staged-changes',
  'untracked-files',
  'stashes-present',
  'unpushed-commits',
]);

/**
 * Prueft alle Bedingungen des Neuaufbaus. Jede Verletzung wird gesammelt, damit
 * der Bericht nicht nur den ersten Grund nennt.
 */
export function canRebuildWorker({
  pr = null,
  mergeShaOnMain = false,
  originMainSha = null,
  localHead = null,
  remoteHead = null,
  dirtyPaths = [],
  stagedPaths = [],
  untrackedPaths = [],
  stashCount = 0,
  unpushedCommits = 0,
} = {}) {
  const reasons = [];
  if (!pr) reasons.push('pr-missing');
  else {
    if (pr.merged !== true) reasons.push('pr-not-merged');
    if (!pr.mergeCommitSha) reasons.push('merge-sha-missing');
    else if (!mergeShaOnMain) reasons.push('merge-sha-not-on-main');
    if (pr.headRefOid && localHead && pr.headRefOid !== localHead) reasons.push('local-head-diverged');
    if (pr.headRefOid && remoteHead && pr.headRefOid !== remoteHead) reasons.push('remote-head-diverged');
  }
  if (dirtyPaths.length > 0) reasons.push('dirty-worktree');
  if (stagedPaths.length > 0) reasons.push('staged-changes');
  if (untrackedPaths.length > 0) reasons.push('untracked-files');
  if (stashCount > 0) reasons.push('stashes-present');
  if (unpushedCommits > 0) reasons.push('unpushed-commits');
  return {
    ok: reasons.length === 0,
    reasons,
    base: originMainSha,
    rebuildFrom: originMainSha ?? 'origin/main',
  };
}

/**
 * Plant den Neuaufbau als Befehlsliste; `--force` kommt nicht vor. Der
 * Workspace-Container und die Identitaetsdatei werden nicht angefasst.
 */
export function planWorkerRebuild({ workerPath, branch, base = 'origin/main' } = {}) {
  if (!workerPath || !branch) throw new Error('WORKTREE: Pfad und Branch sind Pflicht');
  return [
    'git fetch --prune origin',
    `git worktree remove ${workerPath}`,
    `git worktree add -b ${branch} ${workerPath} ${base}`,
  ];
}
