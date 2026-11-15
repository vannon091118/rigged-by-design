/**
 * @test-target: scripts/lib/claim-hygiene.mjs
 * @error-code: ERR-4019
 *
 * Ein offener Claim auf einem belegten geschlossenen Issue ist ein
 * Closeout-Verstoss. Unbekannte Status duerfen weder als offen noch als
 * geschlossen geraten werden.
 */
import { describe, expect, it } from 'vitest';
import {
  auditClaimHygiene, formatClaimHygiene, normalizeIssueStates,
} from '../../../../scripts/lib/claim-hygiene.mjs';

const claim = (overrides: Record<string, unknown> = {}) => ({
  id: 'lane/governance/example',
  branch: 'lane/governance/example',
  owner: 'Integrator',
  issue: 861,
  status: 'open',
  ...overrides,
});

describe('Claim-Hygiene (#861)', () => {
  it('meldet einen offenen Claim auf einem geschlossenen Issue', () => {
    const result = auditClaimHygiene({
      claims: [claim()],
      issueStates: new Map([[861, 'closed']]),
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ id: 'lane/governance/example', issueState: 'closed' });
    expect(formatClaimHygiene(result)).toContain('ROT');
  });

  it('laesst einen bereits gemergten Claim auf geschlossenem Issue zu', () => {
    const result = auditClaimHygiene({
      claims: [claim({ status: 'merged' })],
      issueStates: new Map([[861, 'closed']]),
    });
    expect(result.violations).toEqual([]);
  });

  it('behandelt fehlenden Issue-Status als unknown und nicht als Verstoss', () => {
    const result = auditClaimHygiene({ claims: [claim()], issueStates: new Map() });
    expect(result.violations).toEqual([]);
    expect(result.unknown).toHaveLength(1);
    expect(result.rows[0]?.issueState).toBe('unknown');
  });

  it('liest Board-State-Cursor als offen und explizite Closed-Liste als geschlossen', () => {
    const states = normalizeIssueStates({
      issues: { 11: { status: 'OK' }, 12: { state: 'closed' } },
      closedIssuesThisRun: [13],
    });
    expect(states.get(11)).toBe('open');
    expect(states.get(12)).toBe('closed');
    expect(states.get(13)).toBe('closed');
  });

  it('bevorzugt ein explizit geschlossenes Issue gegen eine offene Liste', () => {
    const states = normalizeIssueStates({ open: [7], closed: [7] });
    expect(states.get(7)).toBe('closed');
  });

  it('listet alle Claims mit ihrem Status, auch ohne Issue-Nummer', () => {
    const result = auditClaimHygiene({
      claims: [claim(), claim({ id: 'lane/legacy', issue: undefined, status: 'archived' })],
      issueStates: new Map([[861, 'open']]),
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toMatchObject({ issue: null, issueState: 'unknown', violation: false });
    expect(result.counts.claims).toBe(2);
    expect(result.counts.openClaims).toBe(1);
  });
});
