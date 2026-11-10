/**
 * @test-target: scripts/lib/promote-guard.mjs
 * @error-code: ERR-4019
 *
 * Ein Merge darf nur den Commit treffen, den die CI geprueft hat, und nur aus
 * dem eigenen Repository. Der Branch-Name allein ist keine Identitaet, und der
 * gruene Pflichtstatus zaehlt nur aus genau diesem Lauf und dieser Basis.
 */
import { describe, expect, it } from 'vitest';
import {
  manualDispatchAction,
  promotionPrListArgs,
  verifyPromotion,
} from '../../../../scripts/lib/promote-guard.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'c'.repeat(40);
const RUN_ID = '42741715408';

const greenGate = {
  name: 'Fail-Closed Gates',
  head_sha: SHA,
  status: 'completed',
  conclusion: 'success',
  details_url: `https://github.com/vannon091118/rigged-by-design/actions/runs/${RUN_ID}/job/129584112479`,
  pull_requests: [{ base: { sha: BASE } }],
};

const valid = {
  event: 'pull_request',
  repo: 'vannon091118/rigged-by-design',
  headRepo: 'vannon091118/rigged-by-design',
  branch: 'lane/governance/beispiel',
  headSha: SHA,
  baseSha: BASE,
  ciRunId: RUN_ID,
  checkRuns: [greenGate],
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
    expect(verifyPromotion({ ...valid, event: '' }).ok).toBe(false);
  });

  it('sucht Promotions-PRs nur gegen main', () => {
    const args = promotionPrListArgs('lane/governance/beispiel');
    expect(args.slice(0, 6)).toEqual([
      'pr',
      'list',
      '--base',
      'main',
      '--head',
      'lane/governance/beispiel',
    ]);
  });

  it('behandelt einen manuellen Dispatch nie als Merge-Erfolg', () => {
    expect(manualDispatchAction('')).toBe('inspect');
    expect(manualDispatchAction('success')).toBe('inspect');
    expect(manualDispatchAction('integrate')).toBe('integrate');
  });

  it('lehnt einen kurzen oder fehlenden SHA ab', () => {
    expect(verifyPromotion({ ...valid, headSha: 'abc1234' }).ok).toBe(false);
  });

  it('lehnt einen PR mit passendem Head aber Ziel integration ab', () => {
    expect(verifyPromotion({ ...valid, pr: { ...valid.pr, baseRefName: 'integration' } }).ok).toBe(false);
  });

  it('lehnt einen geschlossenen PR ab', () => {
    expect(verifyPromotion({ ...valid, pr: { ...valid.pr, state: 'MERGED' } }).ok).toBe(false);
  });

  it('lehnt einen gruenen Check aus einem aelteren Lauf ab', () => {
    const older = { ...greenGate, details_url: greenGate.details_url.replace(RUN_ID, '42000000000') };
    expect(verifyPromotion({ ...valid, checkRuns: [older] }).ok).toBe(false);
  });

  it('lehnt einen gruenen Check gegen eine andere Basis ab', () => {
    const other = { ...greenGate, pull_requests: [{ base: { sha: 'd'.repeat(40) } }] };
    expect(verifyPromotion({ ...valid, checkRuns: [other] }).ok).toBe(false);
  });

  it('verlangt Check-Runs, Basis und Lauf-ID statt einer Behauptung', () => {
    expect(verifyPromotion({ ...valid, checkRuns: null }).ok).toBe(false);
    expect(verifyPromotion({ ...valid, checkRuns: [] }).ok).toBe(false);
    expect(verifyPromotion({ ...valid, baseSha: '' }).ok).toBe(false);
    expect(verifyPromotion({ ...valid, ciRunId: '' }).ok).toBe(false);
  });

  it('lehnt einen roten Pflichtstatus auf demselben Kopf ab', () => {
    expect(verifyPromotion({ ...valid, checkRuns: [{ ...greenGate, conclusion: 'failure' }] }).ok).toBe(false);
  });
});
