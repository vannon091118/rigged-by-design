/**
 * @test-target: scripts/lib/board-usage.mjs
 * @error-code: ERR-4019
 *
 * Das Board ist die Steuerungswahrheit; die lokale Claim-Datei ist nur ein
 * Spiegel. Der Test haelt die Fail-Closed-Regel fest: ohne lesbaren
 * Issue-Verlauf gibt es keinen Beleg, und ohne Beleg startet und pusht keine
 * Lane. Genau dort war die Luecke - ein unbekanntes Board war eine Warnung.
 */
import { describe, expect, it } from 'vitest';
import { evaluateBoardUsage, releaseForClaim } from '../../../../scripts/lib/board-usage.mjs';

type IssueClaim = {
  checked: boolean;
  number: number;
  state: string;
  status: string;
  claimId?: string;
  holder?: string;
  error?: string;
  labels?: { name: string }[];
  comments?: { author: { login: string }; body: string; createdAt?: string }[];
};

const CLAIM = { id: 'lane/governance/issue-12', issue: 12, status: 'open' };
const CLAIM_LINE = 'CLAIM [A1] liilith 2026-11-15T07:00:00Z scope=scripts/lib plan=Gate bauen';

function issueClaim(over: Partial<IssueClaim> = {}): IssueClaim {
  return {
    checked: true,
    number: 12,
    state: 'OPEN',
    status: 'claimed-self',
    claimId: 'A1',
    holder: 'liilith',
    labels: [{ name: 'prio-p1' }],
    comments: [{ author: { login: 'vannon091118' }, body: CLAIM_LINE }],
    ...over,
  };
}

describe('evaluateBoardUsage', () => {
  it('laesst main ohne Lane-Beleg durch', () => {
    const result = evaluateBoardUsage({ branch: 'main' });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('blockiert eine Lane ohne Claim', () => {
    const result = evaluateBoardUsage({ branch: 'lane/x', claim: null, issueClaim: issueClaim() });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('kein Lane-Claim');
  });

  it('blockiert, wenn das Board nicht lesbar ist - statt zu warnen', () => {
    const result = evaluateBoardUsage({
      branch: 'lane/x',
      claim: CLAIM,
      issueClaim: { checked: false, status: 'unknown', number: 12, error: 'gh fehlt' } as IssueClaim,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('nicht lesbar');
    expect(result.failures.join(' ')).toContain('GH_TOKEN');
  });

  it('blockiert, wenn kein CLAIM-Kommentar am Issue steht', () => {
    const result = evaluateBoardUsage({
      branch: 'lane/x',
      claim: CLAIM,
      issueClaim: issueClaim({ status: 'free', claimId: undefined, holder: undefined }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('keinen CLAIM-Kommentar');
  });

  it('blockiert einen fremden Claim', () => {
    const result = evaluateBoardUsage({
      branch: 'lane/x',
      claim: CLAIM,
      issueClaim: issueClaim({ status: 'claimed-other', holder: 'jenova', claimId: 'A2' }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('jenova');
  });

  it('akzeptiert einen eigenen, offenen Board-Claim', () => {
    const result = evaluateBoardUsage({ branch: 'lane/x', claim: CLAIM, issueClaim: issueClaim() });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('verlangt fuer die Uebergabe Label und RELEASE-Kommentar', () => {
    const withoutHandover = evaluateBoardUsage({
      branch: 'lane/x',
      claim: CLAIM,
      issueClaim: issueClaim(),
      requireCloseout: true,
    });
    expect(withoutHandover.ok).toBe(false);
    expect(withoutHandover.failures.join(' ')).toContain('review-waiting');

    const withHandover = evaluateBoardUsage({
      branch: 'lane/x',
      claim: CLAIM,
      issueClaim: issueClaim({
        labels: [{ name: 'review-waiting' }],
        comments: [
          { author: { login: 'vannon091118' }, body: CLAIM_LINE },
          { author: { login: 'vannon091118' }, body: 'RELEASE [A1] done 6e4f344' },
        ],
      }),
      requireCloseout: true,
    });
    expect(withHandover.ok).toBe(true);
    expect(withHandover.facts.flat().join(' ')).toContain('6e4f344');
  });

  it('liest RELEASE nur fuer den genannten Claim', () => {
    const comments = [
      { author: { login: 'vannon091118' }, body: 'RELEASE [A7] done aaaa111' },
      { author: { login: 'vannon091118' }, body: 'RELEASE [A1] done bbbb222' },
    ];
    expect(releaseForClaim(comments, 'A1')?.sha).toBe('bbbb222');
    expect(releaseForClaim(comments, 'A2')).toBeNull();
  });
});
