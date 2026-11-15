/**
 * @test-target: scripts/lib/work-claim.mjs
 * @error-code: ERR-4027
 *
 * #693/#694: Ein gemeinsamer GitHub-Principal trennt die Rollen nicht. Ein
 * Verdikt (`ACCEPT`, `PARTIAL`, `REJECT`, `MERGED`, `CLOSED`) wirkt nur von
 * einem exklusiven Maintainer-Login; Worker geben nur den eigenen Claim frei,
 * und Identitaetsreservierungen brauchen einen autorisierten Autor.
 */
import { describe, expect, it } from 'vitest';
import { evaluateIssueClaim } from '../../../../scripts/lib/issue-claim.mjs';
import { describeActorPolicy, evaluateWorkState } from '../../../../scripts/lib/work-claim.mjs';
import { resolveReservations } from '../../../../scripts/lib/worker-identity.mjs';

const SHARED = { maintainers: ['vannon091118'], users: ['vannon091118'], workers: ['vannon091118'] };
const SEPARATED = { maintainers: ['maintainer'], users: ['owner'], workers: ['worker'] };
const comment = (id: string, login: string, body: string) => ({ id, author: { login }, body });
const reviewedBy = (login: string) => [
  comment('1', login, 'WORK_CLAIM claim_id=wc-1'),
  comment('2', login, 'DONE claim_id=wc-1'),
  comment('3', login, 'REVIEW_PENDING claim_id=wc-1'),
];
const reviewed = reviewedBy('worker');

// Der Claim ist bewusst frisch: sonst greift die 2h-Stale-Frist statt der Autorenpruefung.
const CLAIM_NOW = Date.parse('2026-11-14T01:30:00Z');

describe('Rollentrennung (#694)', () => {
  it('verwirft ein Verdikt vom gemeinsamen Principal', () => {
    const result = evaluateWorkState(
      [...reviewedBy('vannon091118'), comment('4', 'vannon091118', 'ACCEPT claim_id=wc-1')],
      { actors: SHARED },
    );
    expect(result.state).toBe('REVIEW_PENDING');
    expect(result.rejected).toContainEqual(
      expect.objectContaining({ kind: 'ACCEPT', reason: 'shared-principal-not-authorized' }),
    );
  });

  it('akzeptiert dasselbe Verdikt von einem exklusiven Maintainer', () => {
    const result = evaluateWorkState(
      [...reviewed, comment('4', 'maintainer', 'ACCEPT claim_id=wc-1')],
      { actors: SEPARATED },
    );
    expect(result.state).toBe('ACCEPTED');
  });

  it('meldet die fehlende Trennung als Policy-Befund', () => {
    expect(describeActorPolicy(SHARED)).toContain('no-exclusive-maintainer-principal');
    expect(describeActorPolicy(SEPARATED)).toEqual([]);
  });
});

describe('Issue-Claim-Bindung (#693)', () => {
  const claimOf = (id: string, login: string, agent: string, claimId: string) => ({
    id,
    author: { login },
    createdAt: '2026-11-14T00:00:00Z',
    body: `CLAIM [${claimId}] ${agent} 2026-11-14T00:00Z scope=src plan=x`,
  });
  const releaseOf = (id: string, login: string, claimId = 'A1') => ({
    id,
    author: { login },
    createdAt: '2026-11-14T01:00:00Z',
    body: `RELEASE [${claimId}] done sha=abc1234`,
  });

  it('laesst einen Worker den eigenen Claim freigeben', () => {
    const result = evaluateIssueClaim({
      comments: [claimOf('1', 'worker', 'LIILITH', 'A1'), releaseOf('2', 'worker')],
      agent: 'LIILITH',
      actors: SEPARATED,
    });
    expect(result.status).toBe('free');
    expect(result.rejected).toEqual([]);
  });

  it('verweigert die Freigabe eines fremden Claims', () => {
    const result = evaluateIssueClaim({
      comments: [claimOf('1', 'worker', 'LIILITH', 'A1'), releaseOf('2', 'other-worker')],
      agent: 'Shinon',
      actors: { ...SEPARATED, workers: ['worker', 'other-worker'] },
      now: CLAIM_NOW,
    });
    expect(result).toMatchObject({ status: 'claimed-other', holder: 'LIILITH' });
    expect(result.rejected).toContainEqual(expect.objectContaining({ reason: 'not-claim-holder' }));
  });

  it('laesst den Maintainer einen fremden Claim freigeben', () => {
    const result = evaluateIssueClaim({
      comments: [claimOf('1', 'worker', 'LIILITH', 'A1'), releaseOf('2', 'maintainer')],
      agent: 'LIILITH',
      actors: SEPARATED,
    });
    expect(result.status).toBe('free');
  });

  it('verdraengt einen laufenden Claim nicht per zweitem CLAIM', () => {
    const result = evaluateIssueClaim({
      comments: [claimOf('1', 'worker', 'LIILITH', 'A1'), claimOf('2', 'other-worker', 'Shinon', 'A2')],
      agent: 'Shinon',
      actors: { ...SEPARATED, workers: ['worker', 'other-worker'] },
      now: CLAIM_NOW,
    });
    expect(result).toMatchObject({ status: 'claimed-other', holder: 'LIILITH', claimId: 'A1' });
    expect(result.rejected).toContainEqual(expect.objectContaining({ reason: 'claim-conflict' }));
  });
});

describe('Identity-Autorisierung (#693)', () => {
  const identityClaim = (id: string, name: string, login = 'worker') => ({
    id,
    author: { login },
    body: `IDENTITY_CLAIM name=${name} system=sys-1 workspace=ws-1 repo=r session=s claim_id=idc-1 at=2026-11-14T00:00:00Z`,
  });

  it('akzeptiert die Reservierung eines autorisierten Workers', () => {
    const state = resolveReservations([identityClaim('1', 'LIILITH')], { actors: SEPARATED });
    expect(state.reserved.map((entry: { name: string }) => entry.name)).toEqual(['LIILITH']);
    expect(state.rejected).toEqual([]);
  });

  it('verwirft Reservierungen unbekannter und unzustaendiger Autoren', () => {
    const unknown = resolveReservations([identityClaim('1', 'LIILITH', 'mallory')], { actors: SEPARATED });
    expect(unknown.reserved).toHaveLength(0);
    expect(unknown.rejected[0]).toMatchObject({ reason: 'unknown-author' });
    const user = resolveReservations([identityClaim('2', 'Shinon', 'owner')], { actors: SEPARATED });
    expect(user.reserved).toHaveLength(0);
    expect(user.rejected[0]).toMatchObject({ reason: 'unauthorized-author' });
  });

  it('reserviert ohne Actor-Policy gar nichts', () => {
    const state = resolveReservations([identityClaim('1', 'LIILITH')]);
    expect(state.reserved).toHaveLength(0);
    expect(state.free).toEqual(['LIILITH', 'Shinon', 'Jenova']);
  });
});
