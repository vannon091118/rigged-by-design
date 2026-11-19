/**
 * @test-target: scripts/lib/claim-lifecycle.mjs
 * @error-code: ERR-4019
 *
 * Ein Claim, der schon `merged` ist, taucht im Reconcile-Plan nicht mehr auf.
 * Sein Task braucht den Branch-Status trotzdem, sonst bleibt er dauerhaft in
 * `READY`/`IMPLEMENTING` stehen. Entfernter Branch schliesst, vorhandener und
 * unlesbarer halten fail-closed offen.
 */
import { describe, expect, it } from 'vitest';
import { mergedClaimEvidence } from '../../../../scripts/lib/claim-lifecycle.mjs';

const sha = (char: string) => char.repeat(40);

function claim(id: string, status = 'merged', branch = `lane/governance/${id}`) {
  return { id: `lane/governance/${id}`, branch, status };
}

describe('branch evidence for already merged claims', () => {
  it('belegt den entfernten Branch auch fuer einen bereits gemergten Claim', () => {
    const evidence = mergedClaimEvidence({ claims: [claim('stale')], heads: new Map([['main', sha('a')]]) });
    expect(evidence.get('lane/governance/stale')).toEqual({
      branchCleanup: { state: 'done', evidence: 'remote-branch-absent' },
    });
  });

  it('haelt einen vorhandenen Branch offen und eine unlesbare Remote unbekannt', () => {
    const claims = [claim('aktiv')];
    const heads = new Map([['lane/governance/aktiv', sha('b')]]);
    expect(mergedClaimEvidence({ claims, heads }).get('lane/governance/aktiv')).toEqual({
      branchCleanup: { state: 'pending', evidence: 'remote-branch-present' },
    });
    expect(mergedClaimEvidence({ claims, heads: null }).get('lane/governance/aktiv')).toEqual({
      branchCleanup: { state: 'unknown', evidence: 'remote-heads-unreadable' },
    });
  });

  it('ignoriert Claims, die nicht gemergt sind', () => {
    expect(mergedClaimEvidence({ claims: [claim('offen', 'open')], heads: new Map() }).size).toBe(0);
  });
});
