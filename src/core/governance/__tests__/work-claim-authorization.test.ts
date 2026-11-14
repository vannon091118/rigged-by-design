/**
 * @test-target: scripts/lib/work-claim.mjs
 * @error-code: ERR-4027
 *
 * #693: Kein Kommentar autorisiert sich selbst. Nur ein verifizierter Autor
 * mit passender Rolle und Claim-ID aendert den Board-Zustand; Rollen kommen aus
 * der Actor-Policy, nicht aus dem Text. Replay, fremde Claim-ID und unerlaubte
 * Reihenfolge bleiben Befunde, keine Zustandsaenderung.
 */
import { describe, expect, it } from 'vitest';
import { evaluateIssueClaim } from '../../../../scripts/lib/issue-claim.mjs';
import { evaluateWorkState } from '../../../../scripts/lib/work-claim.mjs';

/** Getrennte Principals: Worker duerfen nicht wie Maintainer aussehen. */
const ACTORS = { maintainers: ['maintainer'], users: ['owner'], workers: ['worker'] };
const comment = (id: number, login: string, body: string) => ({ id: String(id), author: { login }, body });
const reviewed = [
  comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1 identity=LIILITH'),
  comment(2, 'worker', 'DONE claim_id=wc-1'),
  comment(3, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
];

describe('Kommentar-Autorisierung', () => {
  it('akzeptiert ein Verdikt nur von einem getrennten Maintainer-Principal', () => {
    expect(evaluateWorkState(reviewed, { actors: ACTORS }).state).toBe('REVIEW_PENDING');
    const verdict = evaluateWorkState([...reviewed, comment(4, 'maintainer', 'ACCEPT claim_id=wc-1')], { actors: ACTORS });
    expect(verdict.state).toBe('ACCEPTED');
    const forged = evaluateWorkState([...reviewed, comment(4, 'worker', 'ACCEPT claim_id=wc-1')], { actors: ACTORS });
    expect(forged.state).toBe('REVIEW_PENDING');
    expect(forged.rejected).toContainEqual(expect.objectContaining({ kind: 'ACCEPT', reason: 'unauthorized-author' }));
  });

  it('ignoriert eine im Text behauptete Rolle eines unbekannten Autors', () => {
    const result = evaluateWorkState(
      [comment(1, 'mallory', 'WORK_CLAIM claim_id=wc-9 identity=MAINTAINER')],
      { actors: ACTORS },
    );
    expect(result.state).toBe('OPEN');
    expect(result.rejected[0]).toMatchObject({ reason: 'unknown-author' });
  });

  it('bindet Worker-Ereignisse an die aktive Claim-ID', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      comment(2, 'worker', 'DONE claim_id=wc-2'),
    ], { actors: ACTORS });
    expect(result.state).toBe('ACTIVE');
    expect(result.rejected).toContainEqual(expect.objectContaining({ kind: 'DONE', reason: 'claim-mismatch' }));
  });

  it('zaehlt ein Replay derselben Zeile genau einmal', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      { id: '2', author: { login: 'worker' }, body: 'DONE claim_id=wc-1\nDONE claim_id=wc-1' },
      comment(3, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
    ], { actors: ACTORS });
    expect(result.state).toBe('REVIEW_PENDING');
    expect(result.rejected.filter((entry: { reason: string }) => entry.reason === 'duplicate-event')).toHaveLength(1);
  });

  it('erzwingt die Uebergangstabelle', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      comment(2, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
    ], { actors: ACTORS });
    expect(result.state).toBe('ACTIVE');
    expect(result.rejected[0]).toMatchObject({ reason: 'transition-not-allowed' });
  });

  it('laesst ohne Actor-Policy kein Ereignis wirken', () => {
    const result = evaluateWorkState(reviewed);
    expect(result.state).toBe('OPEN');
    expect(result.rejected.every((entry: { reason: string }) => entry.reason === 'unknown-author')).toBe(true);
  });

  it('oeffnet und uebernimmt Issue-Claims nur fuer autorisierte Autoren', () => {
    const claim = (login: string) => ({
      id: '1', author: { login }, createdAt: '2026-11-14T00:00:00Z',
      body: 'CLAIM [A1] LIILITH 2026-11-14T00:00Z scope=src plan=x',
    });
    const unauthorized = evaluateIssueClaim({ comments: [claim('mallory')], agent: 'LIILITH', actors: ACTORS });
    expect(unauthorized.status).toBe('free');
    expect(unauthorized.rejected[0]).toMatchObject({ reason: 'unknown-author' });
    const authorized = evaluateIssueClaim({ comments: [claim('worker')], agent: 'LIILITH', actors: ACTORS });
    expect(authorized.status).toBe('claimed-self');
  });
});
