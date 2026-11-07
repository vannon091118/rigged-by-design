/**
 * @test-target: scripts/lib/claim-evidence.mjs
 * @error-code: ERR-4019
 *
 * Ein geloeschter Branch ist kein Merge-Nachweis. Genau dieser Fall steht
 * hier: Basis-SHA auf `main` ohne Branch-Kopf ergibt **keinen** Status; erst
 * ein gemergter PR, ein Branch-Kopf auf `main` oder ein baumgleicher Commit
 * auf `main` macht den Claim `merged`.
 */
import { describe, expect, it } from 'vitest';
import { decideClaim, localMergeEvidence, mergedPullRequestIndex } from '../../../../scripts/lib/claim-evidence.mjs';

/** Git-Aufrufe als Tabelle: der Test braucht kein Repository, nur Antworten. */
function fakeGit(answers: Record<string, string | Error>) {
  return (args: string[]) => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

describe('claim-evidence', () => {
  it('macht einen geloeschten Branch ohne Beleg nicht merged', () => {
    expect(decideClaim({ branchExists: false, branchHeadOnMain: false, mergedPr: null })).toEqual({
      status: null,
      evidence: 'none',
      why: 'Branch nicht am Remote, kein Merge-Beleg',
    });
  });

  it('erkennt einen gemergten Pull Request mit exaktem Kopf als Beleg', () => {
    const headSha = 'a'.repeat(40);
    const result = decideClaim({
      branchExists: false,
      headSha,
      mergedPr: { number: 215, headRefOid: headSha, mergeCommit: 'fb5ed49cd9ed' },
    });
    expect({ status: result.status, evidence: result.evidence }).toEqual({ status: 'merged', evidence: 'merged-pr' });
  });

  it('akzeptiert einen gemergten PR nicht ohne exakten Claim-Kopf', () => {
    const result = decideClaim({
      branchExists: false,
      headSha: 'a'.repeat(40),
      mergedPr: { number: 215, headRefOid: 'b'.repeat(40), mergeCommit: 'fb5ed49cd9ed' },
    });
    expect(result.status).toBeNull();
  });

  it('erfindet ohne lokalen Kopf keinen PR-Beleg', () => {
    const result = decideClaim({
      branchExists: false,
      mergedPr: { number: 215, headRefOid: 'b'.repeat(40), mergeCommit: 'fb5ed49cd9ed' },
    });
    expect(result.status).toBeNull();
    expect(result.evidence).toBe('none');
  });

  it('erkennt einen Branch-Kopf auf main als Beleg', () => {
    const result = decideClaim({ branchExists: true, branchHeadOnMain: true });
    expect({ status: result.status, evidence: result.evidence }).toEqual({ status: 'merged', evidence: 'branch-head-on-main' });
  });

  it('erkennt einen baumgleichen Commit auf main als Beleg', () => {
    const result = decideClaim({ branchExists: true, branchTreeOnMain: 'a490d4ae72599efc7f9bc375cedc37f6d35a62f1' });
    expect({ status: result.status, evidence: result.evidence }).toEqual({ status: 'merged', evidence: 'branch-tree-on-main' });
  });

  it('liest den Merge-Beleg aus der lokalen Historie', () => {
    const git = fakeGit({
      'rev-parse --verify --quiet refs/heads/lane/governance/12-slice-b-diagnostics': 'head12',
      'merge-base --is-ancestor head12 origin/main': new Error('kein Vorfahr'),
      'rev-parse head12^{tree}': 'tree12',
      'log --format=%H %T origin/main': 'a490d4a tree12\nd6c8ac8 tree0',
    });
    expect(localMergeEvidence({ branch: 'lane/governance/12-slice-b-diagnostics', git })).toEqual({
      headSha: 'head12',
      headOnMain: false,
      treeOnMain: 'a490d4a',
    });
  });

  it('meldet ohne lokalen Branch keinen Baum-Beleg', () => {
    const local = localMergeEvidence({ branch: 'lane/governance/12-slice-b-diagnostics', git: fakeGit({}) });
    expect({ headSha: local.headSha, treeOnMain: local.treeOnMain }).toEqual({ headSha: null, treeOnMain: null });
  });

  it('filtert gemergte PRs nach main, eigenem Repo und vollem Kopf-SHA', () => {
    const head = 'a'.repeat(40);
    const index = mergedPullRequestIndex({
      gh: () =>
        JSON.stringify([
          {
            baseRefName: 'main',
            headRefName: 'lane/ok',
            headRefOid: head,
            isCrossRepository: false,
            number: 1,
            mergeCommit: { oid: 'b'.repeat(40) },
            url: 'https://example.test/1',
          },
          {
            baseRefName: 'integration',
            headRefName: 'lane/falsches-ziel',
            headRefOid: head,
            isCrossRepository: false,
            number: 2,
            mergeCommit: { oid: 'b'.repeat(40) },
            url: 'https://example.test/2',
          },
          {
            baseRefName: 'main',
            headRefName: 'lane/fork',
            headRefOid: head,
            isCrossRepository: true,
            number: 3,
            mergeCommit: { oid: 'b'.repeat(40) },
            url: 'https://example.test/3',
          },
          {
            baseRefName: 'main',
            headRefName: 'lane/kurzer-sha',
            headRefOid: 'abc1234',
            isCrossRepository: false,
            number: 4,
            mergeCommit: { oid: 'b'.repeat(40) },
            url: 'https://example.test/4',
          },
        ]),
    });
    expect([...index.keys()]).toEqual(['lane/ok']);
  });

  it('verwirft mehrdeutige PRs mit demselben Branch-Namen', () => {
    const entry = (number: number, headRefOid = 'a'.repeat(40)) => ({
      baseRefName: 'main',
      headRefName: 'lane/wiederverwendet',
      headRefOid,
      isCrossRepository: false,
      number,
      mergeCommit: { oid: 'b'.repeat(40) },
      url: `https://example.test/${number}`,
    });
    const index = mergedPullRequestIndex({
      gh: () => JSON.stringify([entry(1), entry(2, 'c'.repeat(40))]),
    });
    expect(index.size).toBe(0);
    expect(
      decideClaim({
        branchExists: false,
        headSha: 'a'.repeat(40),
        mergedPr: index.get('lane/wiederverwendet') ?? null,
      }).status,
    ).toBeNull();
  });

  it('laesst einen laufenden Branch offen', () => {
    expect(decideClaim({ branchExists: true, branchHeadOnMain: false }).status).toBeNull();
  });
});
