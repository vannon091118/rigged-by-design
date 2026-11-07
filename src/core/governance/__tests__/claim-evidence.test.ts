/**
 * @test-target: scripts/lib/claim-evidence.mjs
 * @error-code: ERR-4019
 *
 * Ein geloeschter Branch ist kein Merge-Nachweis. Genau dieser Fall steht
 * hier: Basis-SHA auf `main` ohne Branch-Kopf ergibt **keinen** Status; erst
 * ein gemergter PR oder ein Branch-Kopf auf `main` macht den Claim `merged`.
 */
import { describe, expect, it } from 'vitest';
import { decideClaim } from '../../../../scripts/lib/claim-evidence.mjs';

describe('claim-evidence', () => {
  it('macht einen geloeschten Branch ohne Beleg nicht merged', () => {
    expect(decideClaim({ branchExists: false, branchHeadOnMain: false, mergedPr: null })).toEqual({
      status: null,
      evidence: 'none',
      why: 'Branch nicht am Remote, kein Merge-Beleg',
    });
  });

  it('erkennt einen gemergten Pull Request als Beleg', () => {
    const result = decideClaim({ branchExists: false, mergedPr: { number: 215, mergeCommit: 'fb5ed49cd9ed' } });
    expect({ status: result.status, evidence: result.evidence }).toEqual({ status: 'merged', evidence: 'merged-pr' });
  });

  it('erkennt einen Branch-Kopf auf main als Beleg', () => {
    const result = decideClaim({ branchExists: true, branchHeadOnMain: true });
    expect({ status: result.status, evidence: result.evidence }).toEqual({ status: 'merged', evidence: 'branch-head-on-main' });
  });

  it('laesst einen laufenden Branch offen', () => {
    expect(decideClaim({ branchExists: true, branchHeadOnMain: false }).status).toBeNull();
  });
});
