/** Resume delivery when a verified commit exists and the worktree is clean. */
export function shouldResumePendingCommit({ worktreeClean, pendingCommits }) {
  return Boolean(worktreeClean) && Number(pendingCommits) > 0;
}
