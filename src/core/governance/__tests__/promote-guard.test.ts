/**
 * @test-target: scripts/lib/promote-guard.mjs
 * @error-code: ERR-4019
 *
 * Ein Merge darf nur den Commit treffen, den die CI geprueft hat, und nur aus
 * dem eigenen Repository. Der Branch-Name allein ist keine Identitaet.
 */
import { describe, expect, it } from 'vitest';
import { verifyPromotion } from '../../../../scripts/lib/promote-guard.mjs';

const SHA = 'a'.repeat(40);

const valid = {
  event: 'pull_request',
  repo: 'vannon091118/rigged-by-design',
  headRepo: 'vannon091118/rigged-by-design',
  branch: 'lane/governance/beispiel',
  headSha: SHA,
  pr: { state: 'OPEN', isCrossRepository: false, headRefOid: SHA, baseRefName: 'main' },
};

describe('promote-guard', () => {
  it('akzeptiert den exakt geprueften PR-Kopf aus dem eigenen Repo', () => {
    expect(verifyPromotion(valid)).toEqual({ ok: true, reason: 'PR-Kopf ist der gepruefte Commit' });
  });

  it('lehnt einen Fork-PR ab', () => {
    expect(verifyPromotion({ ...valid, headRepo: 'fremd/rigged-by-design' }).ok).toBe(false);
  });

  it('lehnt einen PR ab, dessen Kopf nicht der geprueften SHA ist', () => {
    expect(verifyPromotion({ ...valid, pr: { ...valid.pr, headRefOid: 'b'.repeat(40) } }).ok).toBe(false);
  });

  it('lehnt einen Lauf ab, der nicht aus einem PR stammt', () => {
    expect(verifyPromotion({ ...valid, event: 'workflow_dispatch' }).ok).toBe(false);
  });

  it('lehnt einen kurzen oder fehlenden SHA ab', () => {
    expect(verifyPromotion({ ...valid, headSha: 'abc1234' }).ok).toBe(false);
  });

  it('lehnt einen PR gegen ein anderes Ziel als main ab', () => {
    expect(verifyPromotion({ ...valid, pr: { ...valid.pr, baseRefName: 'integration' } }).ok).toBe(false);
  });

  it('lehnt einen geschlossenen PR ab', () => {
    expect(verifyPromotion({ ...valid, pr: { ...valid.pr, state: 'MERGED' } }).ok).toBe(false);
  });
});
