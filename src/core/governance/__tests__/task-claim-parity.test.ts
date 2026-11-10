/**
 * @test-target: scripts/lib/lane-claims.mjs
 * @error-code: ERR-4019
 *
 * Eine einzige Quelle fuer den Lane-Status: Der Task-Vertrag ist die Wahrheit
 * fuer die Phase (AGENTS.md Regel 1), der Claim folgt ihm. Diese Tests halten
 * die Paritaet fest, die `claim-register doctor` mechanisch prueft.
 */
import { describe, expect, it } from 'vitest';
import { auditTaskClaimParity } from '../../../../scripts/lib/lane-claims.mjs';

describe('task-claim parity', () => {
  it('zieht einen offenen Claim bei DONE-Vertrag nach', () => {
    const result = auditTaskClaimParity({
      claims: [{ id: 'lane/x/demo', status: 'open' }],
      tasks: [{ claimId: 'lane/x/demo', phase: 'DONE' }],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('auf merged/superseded/archived nachziehen');
  });

  it('zieht einen nicht-DONE-Vertrag bei gemergtem Claim nach', () => {
    const result = auditTaskClaimParity({
      claims: [{ id: 'lane/x/demo', status: 'merged' }],
      tasks: [{ claimId: 'lane/x/demo', phase: 'CI_PENDING' }],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('auf DONE nachziehen');
  });

  it('laesst konsistente Paare und Endzustaende in Ruhe', () => {
    const result = auditTaskClaimParity({
      claims: [
        { id: 'lane/x/fertig', status: 'merged' },
        { id: 'lane/x/laufend', status: 'open' },
        { id: 'lane/x/parked', status: 'superseded' },
      ],
      tasks: [
        { claimId: 'lane/x/fertig', phase: 'DONE' },
        { claimId: 'lane/x/laufend', phase: 'IMPLEMENTING' },
        { claimId: 'lane/x/parked', phase: 'IMPLEMENTING' },
        { claimId: 'lane/x/ohne-claim', phase: 'DONE' },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
