/**
 * @test-target: scripts/lib/branch-lifecycle.mjs
 * @error-code: ERR-4008
 *
 * Jede Branch ausser `main` ist temporaer. Geloescht wird nur mit Merge-Beleg;
 * offene Arbeit und aktive Worktrees bleiben. Verwaiste Worktree-Eintraege
 * werden geplant, nicht waehrend der Planung entfernt.
 */
import { describe, expect, it } from 'vitest';
import { PROTECTED_BRANCHES, parseWorktrees, planCleanup } from '../../../../scripts/lib/branch-lifecycle.mjs';

describe('branch-lifecycle', () => {
  it('liest Worktrees samt prunable-Markierung', () => {
    const text = [
      'worktree /repo',
      'HEAD aaaa',
      'branch refs/heads/main',
      '',
      'worktree /repo/.worktrees/old',
      'HEAD bbbb',
      'branch refs/heads/lane/test/old',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n');
    expect(parseWorktrees(text)).toEqual([
      { path: '/repo', branch: 'main', head: 'aaaa', prunable: false },
      { path: '/repo/.worktrees/old', branch: 'lane/test/old', head: 'bbbb', prunable: true },
    ]);
  });

  it('loescht nur gemergte temporaere Branches', () => {
    const plan = planCleanup({
      branches: [
        { name: 'main', merged: true },
        { name: 'lane/test/merged', merged: true },
        { name: 'lane/test/open', merged: false },
        { name: 'lane/test/current', merged: true },
      ],
      worktrees: [
        { path: '/repo', branch: 'main', head: 'a', prunable: false },
        { path: '/repo/.worktrees/live', branch: 'lane/test/live', head: 'b', prunable: false },
      ],
      current: 'lane/test/current',
    });
    expect(plan.delete).toEqual(['lane/test/merged']);
    expect(plan.prune).toEqual([]);
    expect(plan.keep.map((entry: { readonly name: string }) => entry.name)).toEqual(['main', 'lane/test/open', 'lane/test/current']);
  });

  it('behaelt offene Arbeit und aktive Worktrees', () => {
    const plan = planCleanup({
      branches: [
        { name: 'lane/test/live', merged: true },
        { name: 'lane/test/open', merged: false },
      ],
      worktrees: [{ path: '/repo/.worktrees/live', branch: 'lane/test/live', head: 'b', prunable: false }],
      current: 'lane/test/open',
    });
    expect(plan.delete).toEqual([]);
    expect(plan.keep.map((entry: { readonly reason: string }) => entry.reason)).toEqual(['aktiver Worktree', 'aktueller Branch']);
    expect(PROTECTED_BRANCHES).toContain('main');
  });

  it('meldet prunable Worktrees getrennt von Branch-Loeschungen', () => {
    const plan = planCleanup({
      branches: [{ name: 'lane/test/merged', merged: true }],
      worktrees: [{ path: '/repo/.worktrees/gone', branch: 'lane/test/merged', head: 'c', prunable: true }],
    });
    expect(plan.delete).toEqual(['lane/test/merged']);
    expect(plan.prune).toEqual(['/repo/.worktrees/gone']);
  });
});
