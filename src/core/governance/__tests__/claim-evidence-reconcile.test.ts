/**
 * @test-target: scripts/lib/claim-evidence.mjs
 * @error-code: ERR-4019
 *
 * Der lesende Reconcile: eine Branch auf `main` oder ein gemergter PR mit
 * Merge-Commit auf `main` belegt den Claim; ein geloeschter Branch ohne Beleg
 * bleibt offen. Geschrieben wird hier nichts.
 */
import { describe, expect, it } from 'vitest';
import { planReconcile, remoteHeads } from '../../../../scripts/lib/claim-evidence.mjs';

function fakeGit(answers: Record<string, string | Error>) {
  return (args: string[]) => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

describe('claim-evidence reconcile', () => {
  it('liest Remote-Koepfe in einem Aufruf', () => {
    const sha = 'a'.repeat(40);
    const heads = remoteHeads({ git: fakeGit({ 'ls-remote --heads origin': `${sha}\trefs/heads/lane/one\n` }) });
    expect(heads?.get('lane/one')).toBe(sha);
    expect(remoteHeads({ git: () => { throw new Error('offline'); } })).toBeNull();
  });

  it('plant einen Reconcile lesend mit Lifecycle-Evidenz', () => {
    const head = 'a'.repeat(40);
    const base = 'b'.repeat(40);
    const git = fakeGit({
      'rev-parse --verify --quiet refs/heads/lane/on-main': head,
      'rev-parse origin/main': base,
      [`merge-base --is-ancestor ${head} origin/main`]: '',
      [`rev-parse ${head}^{tree}`]: 'tree-a',
      'log --format=%H %T origin/main': `${base} tree-a`,
      'ls-remote --heads origin': `${head}\trefs/heads/lane/on-main\n`,
    });
    const plan = planReconcile({
      claims: [{ id: 'lane/test/on-main', branch: 'lane/on-main', status: 'open' }],
      git,
      prIndex: null,
    });
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({
      id: 'lane/test/on-main',
      status: 'merged',
      evidence: 'head-on-main',
    });
    expect(plan.unresolved).toEqual([]);
  });

  it('schliesst einen frischen Branch auf seinem Claim-Startpunkt nicht', () => {
    const head = 'a'.repeat(40);
    const base = 'c'.repeat(40);
    const git = fakeGit({
      'rev-parse --verify --quiet refs/heads/lane/fresh': head,
      'rev-parse origin/main': base,
      [`merge-base --is-ancestor ${head} origin/main`]: '',
      [`rev-parse ${head}^{tree}`]: 'tree-fresh',
      'log --format=%H %T origin/main': `${base} tree-fresh`,
      'ls-remote --heads origin': `${head}\trefs/heads/lane/fresh\n`,
    });
    const plan = planReconcile({
      claims: [{ id: 'lane/test/fresh', branch: 'lane/fresh', status: 'open', baseSha: head }],
      git,
      prIndex: null,
    });
    expect(plan.changes).toEqual([]);
    expect(plan.unresolved).toEqual([]);
  });

  it('belegt einen geloeschten Branch ueber den gemergten PR auf main', () => {
    const merge = 'c'.repeat(40);
    const git = fakeGit({
      'rev-parse --verify --quiet refs/heads/lane/gone': new Error('fehlt'),
      'rev-parse --verify --quiet refs/remotes/origin/lane/gone': new Error('fehlt'),
      'rev-parse origin/main': merge,
      'ls-remote --heads origin': '',
    });
    const prIndex = new Map([
      ['lane/gone', { number: 7, headRefOid: 'd'.repeat(40), mergeCommit: merge, url: null }],
    ]);
    const plan = planReconcile({
      claims: [{ id: 'lane/test/gone', branch: 'lane/gone', status: 'open' }],
      git,
      prIndex,
    });
    expect(plan.changes[0]).toMatchObject({ status: 'merged', evidence: 'merged-pr', sha: merge });
  });
});
