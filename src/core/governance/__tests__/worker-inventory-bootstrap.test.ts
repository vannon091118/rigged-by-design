/**
 * @test-target: scripts/lib/repo-inventory.mjs
 * @error-code: ERR-4027
 *
 * Bestaende werden am Remote erkannt, nicht am Ordnernamen. Die Inventur
 * klassifiziert jeden Worktree und sperrt Aufraeumen, sobald ein Pfad
 * unlesbar ist oder eine Dublette existiert. Der Neuaufbau braucht einen
 * belegten Merge und einen sauberen Baum.
 */
import { describe, expect, it } from 'vitest';
import { classifyEntry, inventoryReport, normalizeRemote } from '../../../../scripts/lib/repo-inventory.mjs';
import { canRebuildWorker, planWorkerRebuild } from '../../../../scripts/lib/worktree-lifecycle.mjs';

describe('Repository-Inventur', () => {
  it('erkennt dasselbe Repo ueber HTTPS, SSH und SCP-Form', () => {
    const expected = 'github.com/vannon091118/rigged-by-design';
    expect(normalizeRemote('https://github.com/vannon091118/rigged-by-design.git')).toBe(expected);
    expect(normalizeRemote('git@github.com:vannon091118/rigged-by-design.git')).toBe(expected);
    expect(normalizeRemote('ssh://git@github.com/vannon091118/rigged-by-design')).toBe(expected);
    expect(normalizeRemote('https://github.com/other/repo.git')).not.toBe(expected);
  });

  it('klassifiziert offene Arbeit, Review und Dubletten', () => {
    expect(classifyEntry({ role: 'main' })).toBe('MAIN_CLEAN');
    expect(classifyEntry({ role: 'main', stashCount: 1 })).toBe('MAIN_DIRTY');
    expect(classifyEntry({ role: 'worker', pr: { state: 'OPEN', merged: false } })).toBe('WORKER_REVIEW_PENDING');
    expect(classifyEntry({ role: 'worker', pr: { state: 'OPEN', merged: false, mergedShaOnMain: true } }))
      .toBe('WORKER_MERGED_PENDING_CLEANUP');
    expect(classifyEntry({ role: 'worker', duplicateOf: 'D:/other' })).toBe('DUPLICATE_WORKTREE');
    expect(classifyEntry({ role: 'worker', readable: false })).toBe('INVENTORY_INCOMPLETE');
  });

  it('sperrt Aufraeumen bei unvollstaendiger oder doppelter Inventur', () => {
    const report = inventoryReport([
      { path: 'a', role: 'main' },
      { path: 'b', role: 'worker', pr: { state: 'OPEN', merged: false } },
    ], { unreadablePaths: ['Z:/nicht-erreichbar'] });
    expect(report.incomplete).toBe(true);
    expect(report.cleanupAllowed).toBe(false);
    expect(report.twoWorktrees).toBe(true);
  });
});

describe('Worktree-Lifecycle', () => {
  const merged = {
    number: 603, state: 'MERGED', merged: true, mergeCommitSha: 'abc1234def', headRefOid: 'abc1234def',
  };

  it('baut nur mit belegtem Merge neu auf', () => {
    expect(canRebuildWorker({
      pr: merged, mergeShaOnMain: true, originMainSha: 'abc1234def',
      localHead: 'abc1234def', remoteHead: 'abc1234def',
    })).toMatchObject({ ok: true, reasons: [] });
  });

  it('blockiert offenen PR, fehlenden Merge-SHA und abweichenden HEAD', () => {
    expect(canRebuildWorker({ pr: { ...merged, merged: false } }).reasons)
      .toEqual(expect.arrayContaining(['pr-not-merged', 'merge-sha-not-on-main']));
    expect(canRebuildWorker({ pr: { ...merged, mergeCommitSha: null } }).reasons).toContain('merge-sha-missing');
    expect(canRebuildWorker({ pr: merged, mergeShaOnMain: false }).reasons).toContain('merge-sha-not-on-main');
    expect(canRebuildWorker({ pr: merged, mergeShaOnMain: true, localHead: 'ffff' }).reasons)
      .toContain('local-head-diverged');
  });

  it('blockiert ungesicherte Arbeit im Worker-Tree', () => {
    const result = canRebuildWorker({
      pr: merged, mergeShaOnMain: true, dirtyPaths: ['a.ts'], untrackedPaths: ['b.ts'], stashCount: 2, unpushedCommits: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'dirty-worktree', 'untracked-files', 'stashes-present', 'unpushed-commits',
    ]));
  });

  it('plant den Neuaufbau ohne --force', () => {
    const commands = planWorkerRebuild({ workerPath: 'D:/w', branch: 'lane/sim/x' });
    expect(commands.join('\n')).not.toContain('--force');
    expect(commands.at(-1)).toContain('git worktree add -b lane/sim/x D:/w origin/main');
  });
});
