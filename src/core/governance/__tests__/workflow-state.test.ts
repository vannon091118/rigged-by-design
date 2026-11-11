/**
 * @test-target: scripts/task-state.mjs
 * @error-code: ERR-4019
 *
 * Nach dem Turn zaehlt nur ein belegter Zustand: TESTS_PASSED nach lokaler
 * Pruefung, CI_PENDING nach dem Push. Eine Pause wird nur in einem eigenen
 * Claim und verknuepften Worktree ohne korrupte WIP fortgesetzt; TASK_COMPLETE
 * gibt es nur fuer einen gruenen Run auf exakt denselben SHA.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TASK_COMPLETE,
  TASK_PAUSED,
  afterTaskRecord,
  completeTask,
  afterTaskState,
  completeDecision,
  pauseTask,
  readAfterTask,
  resumeDecision,
  resumeTask,
  writeAfterTask,
} from '../../../../scripts/task-state.mjs';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const claim = { id: 'lane/test/task', owner: 'Tester', branch: 'lane/test/task', pathAllowlist: ['docs/', 'scripts/task-state.mjs'] };
const dirs: string[] = [];

const tempRoot = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-task-state-'));
  dirs.push(dir);
  return dir;
};

const seed = (root: string) => writeAfterTask(
  afterTaskRecord({
    branch: 'lane/test/task',
    head: sha,
    base: other,
    claim,
    own: ['docs/a.md'],
    foreign: [],
    tests: { affected: true, delegated: [] },
    gate: { profile: 'light', script: 'verify:light' },
    next: ['git push -u origin lane/test/task'],
    state: 'TESTS_PASSED',
  }),
  { root },
);

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('after-task', () => {
  it('schreibt TESTS_PASSED vor dem Push und CI_PENDING danach', () => {
    expect(afterTaskState({ gateOk: true, pushed: false })).toBe('TESTS_PASSED');
    expect(afterTaskState({ gateOk: true, pushed: true })).toBe('CI_PENDING');
    expect(afterTaskState({ gateOk: false })).toBeNull();
  });

  it('enthaelt Branch, HEAD, Basis, Claim, Pfade, Tests und Gate', () => {
    const record = afterTaskRecord({
      branch: 'lane/test/task',
      head: sha,
      base: other,
      claim,
      own: ['docs/a.md'],
      foreign: [],
      tests: { affected: true },
      gate: { profile: 'light' },
      next: ['git push'],
      state: 'TESTS_PASSED',
    });
    expect(record.branch).toBe('lane/test/task');
    expect(record.head).toBe(sha);
    expect(record.base).toBe(other);
    expect(record.claim?.id).toBe('lane/test/task');
    expect(record.paths).toEqual({ own: ['docs/a.md'], foreign: [] });
    expect(record.tests.affected).toBe(true);
    expect(record.gate.ok).toBe(true);
    expect(record.next).toEqual(['git push']);
  });

  it('verweigert einen Erfolgszustand fuer ein rotes Gate', () => {
    expect(() => afterTaskRecord({
      branch: 'lane/test/task',
      head: sha,
      state: 'TESTS_PASSED',
      gate: { ok: false },
    })).toThrow(/rotes Gate/);
  });
});

describe('pause und resume', () => {
  it('pausiert und setzt nur im eigenen Claim und Worktree fort', () => {
    const root = tempRoot();
    seed(root);
    const paused = pauseTask({ root, reason: 'Feierabend' });
    expect(paused.state).toBe(TASK_PAUSED);
    expect(paused.previousState).toBe('TESTS_PASSED');

    const decision = resumeDecision({
      record: readAfterTask({ root }),
      branch: 'lane/test/task',
      claim,
      isWorktree: true,
      dirtyPaths: ['docs/b.md'],
    });
    expect(decision.ok).toBe(true);
    expect(decision.state).toBe('TESTS_PASSED');

    const resumed = resumeTask({
      record: readAfterTask({ root }),
      branch: 'lane/test/task',
      claim,
      isWorktree: true,
      dirtyPaths: ['docs/b.md'],
      root,
    });
    expect(resumed.state).toBe('TESTS_PASSED');
    expect(readAfterTask({ root })?.state).toBe('TESTS_PASSED');
  });

  it('adoptiert fremde WIP und blockiert nur Korruption oder falsche Bindung', () => {
    const root = tempRoot();
    seed(root);
    pauseTask({ root });
    const base = { record: readAfterTask({ root }), branch: 'lane/test/task', claim, isWorktree: true };
    expect(resumeDecision({ ...base, dirtyPaths: ['src/ui/hud.tsx'] }).ok).toBe(true);
    expect(resumeDecision({ ...base, dirtyPaths: ['src/core/contracts/save.ts'] }).reasons.join(' ')).toContain('korrupte WIP');
    expect(resumeDecision({ ...base, branch: 'lane/other/task' }).reasons.join(' ')).toContain('Branch');
    expect(resumeDecision({ ...base, claim: null }).reasons.join(' ')).toContain('kein Claim');
    expect(resumeDecision({ ...base, isWorktree: false }).reasons.join(' ')).toContain('Worktree');
  });

  it('laesst einen Resume ohne after-task-Datensatz unveraendert', () => {
    expect(resumeDecision({ record: null })).toEqual({ ok: true, state: null, reasons: [], noRecord: true });
  });
});

describe('task:complete', () => {
  const record = afterTaskRecord({
    branch: 'lane/test/task',
    head: sha,
    state: 'CI_PENDING',
    claim,
    gate: { ok: true },
  });

  it('akzeptiert nur einen gruenen, abgeschlossenen Run fuer denselben SHA', () => {
    const run = { headSha: sha, status: 'completed', conclusion: 'success' };
    expect(completeDecision({ record, headSha: sha, run })).toEqual({ ok: true, reasons: [] });
    expect(completeDecision({ record, headSha: sha, run: { ...run, headSha: other } }).ok).toBe(false);
    expect(completeDecision({ record, headSha: sha, run: { ...run, conclusion: 'failure' } }).ok).toBe(false);
    expect(completeDecision({ record, headSha: sha, run: { ...run, status: 'in_progress' } }).ok).toBe(false);
    expect(completeDecision({ record, headSha: other, run }).ok).toBe(false);
  });

  it('setzt TASK_COMPLETE nur nach bestandener Entscheidung', () => {
    const root = tempRoot();
    seed(root);
    const written = writeAfterTask({ state: TASK_COMPLETE }, { root });
    expect(written.state).toBe(TASK_COMPLETE);
    expect(readAfterTask({ root })?.state).toBe(TASK_COMPLETE);
  });

  it('schreibt TASK_COMPLETE nur bei gruenem Run fuer denselben SHA', () => {
    const root = tempRoot();
    seed(root);
    writeAfterTask({ state: 'CI_PENDING' }, { root });
    const git = () => sha;
    const green = () => JSON.stringify({
      headSha: sha,
      status: 'completed',
      conclusion: 'success',
      url: 'https://example.test/run/1',
    });
    const ok = completeTask({ runId: '42', root, gh: green, git });
    expect(ok.ok).toBe(true);
    expect(readAfterTask({ root })?.state).toBe(TASK_COMPLETE);

    const refusedRoot = tempRoot();
    seed(refusedRoot);
    writeAfterTask({ state: 'CI_PENDING' }, { root: refusedRoot });
    const red = () => JSON.stringify({ headSha: sha, status: 'completed', conclusion: 'failure' });
    const refused = completeTask({ runId: '43', root: refusedRoot, gh: red, git });
    expect(refused.ok).toBe(false);
    expect(readAfterTask({ root: refusedRoot })?.state).toBe('CI_PENDING');
  });

});
