/** @test-target: scripts/lib/pending-commit.mjs */
/** @error-code: ERR-4008 */
import { describe, expect, it } from 'vitest';
import { shouldResumePendingCommit } from '../../../../scripts/lib/pending-commit.mjs';

describe('turn:finish retry decision', () => {
  it('resumes delivery when commits are pending and the worktree is clean', () => {
    expect(shouldResumePendingCommit({ worktreeClean: true, pendingCommits: 1 })).toBe(true);
  });

  it('runs the normal validation path when there are uncommitted changes', () => {
    expect(shouldResumePendingCommit({ worktreeClean: false, pendingCommits: 1 })).toBe(false);
  });

  it('does not resume when the branch has no commits to deliver', () => {
    expect(shouldResumePendingCommit({ worktreeClean: true, pendingCommits: 0 })).toBe(false);
  });
});
