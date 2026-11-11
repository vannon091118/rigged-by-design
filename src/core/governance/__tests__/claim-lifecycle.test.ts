/**
 * @test-target: scripts/lib/claim-lifecycle.mjs
 * @error-code: ERR-4019
 *
 * Retention ist keine blinde Loeschung: aktive Tasks, offene Claims und die
 * gerade bearbeitete Lane bleiben. Geschlossene Tasks werden nach Commit-Zeit
 * sortiert; nur die neuesten zehn behalten ihren Platz. Der Closeout zieht
 * einen Task nur mit gemergtem Claim und ohne offenen Blocker auf DONE.
 */
import { describe, expect, it } from 'vitest';
import {
  TASK_RETENTION_LIMIT,
  claimEntryPath,
  planRetention,
  planTaskCloseout,
} from '../../../../scripts/lib/claim-lifecycle.mjs';
import { mergeClaimRecord } from '../../../../scripts/lib/lane-claims.mjs';

const sha = (char: string) => char.repeat(40);

function contract(id: string, phase = 'DONE', overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    taskId: id,
    claimId: `lane/governance/${id}`,
    branch: `lane/governance/${id}`,
    baseSha: sha('a'),
    phase,
    title: id,
    goal: '',
    taskType: 'aftercare',
    holdMerge: false,
    status: 'READY_FOR_MERGE',
    pr: null,
    findings: [],
    nextAction: 'Naechster Schritt',
    revision: 1,
    ...overrides,
  };
}

function task(id: string, phase: string, committedAt = 0, overrides: Record<string, unknown> = {}) {
  return {
    file: `.lane-claims/tasks/${id}.json`,
    contract: contract(id, phase, overrides),
    committedAt,
  };
}

function claim(id: string, status = 'merged', overrides: Record<string, unknown> = {}) {
  return {
    file: `.lane-claims/claims/lane-governance-${id}.json`,
    claim: {
      id: `lane/governance/${id}`,
      branch: `lane/governance/${id}`,
      status,
      ...overrides,
    },
    committedAt: 0,
  };
}

describe('claim retention', () => {
  it('haelt aktive Tasks und die neuesten geschlossenen Tasks', () => {
    const tasks = [
      task('active', 'IMPLEMENTING', 1),
      task('old', 'DONE', 10),
      task('new', 'DONE', 30),
      task('middle', 'DONE', 20),
    ];
    const plan = planRetention({ tasks, claims: [], keep: 2 });
    expect(plan.retainedTasks).toEqual([
      '.lane-claims/tasks/active.json',
      '.lane-claims/tasks/new.json',
    ]);
    expect(plan.removeTasks).toEqual([
      '.lane-claims/tasks/middle.json',
      '.lane-claims/tasks/old.json',
    ]);
  });

  it('behaelt hoechstens zehn abgeschlossene Tasks und offene Claims', () => {
    const tasks = Array.from({ length: 12 }, (_, index) => task(`t${index}`, 'DONE', index + 1));
    const claims = tasks.map((_entry, index) => claim(`t${index}`, index === 0 ? 'open' : 'merged'));
    const plan = planRetention({ tasks, claims });
    expect(plan.closedTasks).toBe(11);
    expect(plan.retainedTasks).toHaveLength(TASK_RETENTION_LIMIT);
    expect(plan.removeTasks).not.toContain('.lane-claims/tasks/t0.json');
    expect(plan.removeTasks).toContain('.lane-claims/tasks/t1.json');
    expect(plan.retainedClaims).toContain('.lane-claims/claims/lane-governance-t0.json');
    expect(plan.removeClaims).toContain('.lane-claims/claims/lane-governance-t1.json');
  });

  it('schuetzt die eigene Lane auch jenseits des Limits', () => {
    const tasks = Array.from({ length: 12 }, (_, index) => task(`t${index}`, 'DONE', index + 1));
    const plan = planRetention({
      tasks,
      claims: [],
      protectedTaskFiles: ['.lane-claims/tasks/t0.json'],
    });
    expect(plan.removeTasks).not.toContain('.lane-claims/tasks/t0.json');
    expect(plan.retainedTasks).toContain('.lane-claims/tasks/t0.json');
  });

  it('laesst einen DONE-Task mit offenem Claim als Parity-Befund stehen', () => {
    const tasks = [task('open-claim', 'DONE', 1)];
    const plan = planRetention({ tasks, claims: [claim('open-claim', 'open')], keep: 0 });
    expect(plan.removeTasks).toEqual([]);
    expect(plan.retainedTasks).toEqual(['.lane-claims/tasks/open-claim.json']);
  });

  it('leitet den Claim-Dateinamen stabil ab', () => {
    expect(claimEntryPath('lane/governance/post-merge-42')).toBe(
      '.lane-claims/claims/lane-governance-post-merge-42.json',
    );
  });
});

describe('post-merge closeout', () => {
  it('schliesst CI_PENDING nach belegtem Merge auf DONE', () => {
    const tasks = [task('merged', 'CI_PENDING')];
    const claims = [claim('merged', 'merged', { mergedEvidence: 'merged-pr', mergedSha: sha('b') }).claim];
    const changes = planTaskCloseout({ tasks, claims });
    expect(changes).toHaveLength(1);
    expect(changes[0].contract.phase).toBe('DONE');
    expect(changes[0].contract.revision).toBe(2);
    expect(changes[0].contract.nextAction).toContain('merged-pr');
    expect(changes[0].contract.pr).toBeNull();
  });

  it('schliesst MERGE_PENDING und AFTERCARE, aber keinen offenen Claim', () => {
    const tasks = [
      task('merge', 'MERGE_PENDING'),
      task('after', 'AFTERCARE'),
      task('open', 'CI_PENDING'),
    ];
    const claims = [
      claim('merge', 'merged').claim,
      claim('after', 'merged').claim,
      claim('open', 'open').claim,
    ];
    const changes = planTaskCloseout({ tasks, claims });
    expect(changes.map((change: { claimId: string }) => change.claimId)).toEqual([
      'lane/governance/merge',
      'lane/governance/after',
    ]);
  });

  it('haelt einen offenen Blocker offen', () => {
    const tasks = [
      task('blocked', 'CI_PENDING', 1, {
        findings: [{ id: 'F-1', status: 'open', severity: 'blocker', summary: 'offen' }],
      }),
    ];
    expect(planTaskCloseout({ tasks, claims: [claim('blocked', 'merged').claim] })).toEqual([]);
  });
});

describe('claim persistence', () => {
  it('erhaelt Notizen und unbekannte Felder beim Statuswechsel', () => {
    const current = { id: 'x', status: 'open', notes: 'nicht verlieren' };
    const next = { id: 'x', status: 'merged', mergedEvidence: 'tree-on-main', mergedSha: sha('b') };
    expect(mergeClaimRecord(current, next)).toEqual({
      ...current,
      status: 'merged',
      mergedEvidence: 'tree-on-main',
      mergedSha: sha('b'),
    });
  });

  it('entfernt veraltete Merge-Belege, wenn der neue Stand keine hat', () => {
    const current = { id: 'x', status: 'merged', mergedEvidence: 'old', mergedSha: sha('a') };
    const next = { id: 'x', status: 'open' };
    expect(mergeClaimRecord(current, next)).toEqual({ id: 'x', status: 'open' });
  });
});
