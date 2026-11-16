/**
 * @test-target: scripts/lib/merge-queue.mjs
 * @error-code: ERR-4029
 *
 * Der Vertrag aus #913 ist die Queue selbst: ein Plan mit Hash, ein ACK je
 * aktiver Session, nur Position 1 mergefaehig. Fehlt etwas, ist der Zustand
 * HOLD - nie stillschweigend Zustimmung.
 */
import { describe, expect, it } from 'vitest';
import {
  MERGE_STATUS,
  QUEUE_IDLE_COMMAND,
  QUEUE_STATE,
  activeSessions,
  authorizeMerge,
  buildQueue,
  latestPlan,
  parseMergeEvents,
  nextAction,
  planBody,
  planDigest,
  validAcks,
} from '../../../../scripts/lib/merge-queue.mjs';

type Session = { session: string };
type QueueRow = { number: number; status: string; reasons: string[] };

const MAIN = 'a'.repeat(40);
const OTHER_MAIN = 'b'.repeat(40);
const HEAD_A = '1'.repeat(40);
const HEAD_B = '2'.repeat(40);
const AT = '2026-11-16T03:00:00Z';

const comment = (id: number, body: string, login = 'vannon091118') => ({ id, body, user: { login } });
const pullsOf = (entries: [number, string][]) => entries.map(([number, head]) => ({ number, headRefOid: head }));
const join = (id: number, session: string, role = 'worker') =>
  comment(id, `MERGE_SESSION_JOIN role=${role} session=${session} at=${AT}`);
const ack = (id: number, session: string, hash: string, main = MAIN, role = 'worker') =>
  comment(id, `MERGE_ACK session=${session} role=${role} plan=${hash} main=${main} at=${AT}`);
const leave = (id: number, session: string) => comment(id, `MERGE_SESSION_LEAVE session=${session} at=${AT}`);

/** Ein Plan-Kommentar, wie ihn `--publish` schreibt. */
function planComment(id: number, pulls: [number, string][], mainSha = MAIN, revision = 1) {
  const built = planBody({ revision, mainSha, pulls: pullsOf(pulls), at: AT });
  return { id, hash: built.hash, comment: comment(id, built.body) };
}

describe('merge-queue', () => {
  it('sperrt jeden Merge ohne veroeffentlichte Revision', () => {
    const events = parseMergeEvents([join(1, 's1')]);
    const queue = buildQueue({ plan: null, pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.HOLD);
    expect(queue[0].reasons.join(' ')).toContain('#913');
    expect(authorizeMerge({ plan: null, pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN, prNumber: 948 }).ok).toBe(false);
  });

  it('gibt nur Position 1 frei, wenn alle aktiven Sessions bestaetigt haben', () => {
    const plan = planComment(10, [[948, HEAD_A], [949, HEAD_B]]);
    const events = parseMergeEvents([
      join(1, 's1'), join(2, 's2'),
      plan.comment,
      ack(11, 's1', plan.hash), ack(12, 's2', plan.hash),
    ]);
    const latest = latestPlan(events);
    expect(activeSessions(events).map((entry: Session) => entry.session)).toEqual(['s1', 's2']);
    expect(validAcks(events, latest)).toHaveLength(2);
    const queue = buildQueue({ plan: latest, pulls: pullsOf([[949, HEAD_B], [948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue.find((row: QueueRow) => row.number === 948)?.status).toBe(MERGE_STATUS.READY);
    const second = queue.find((row: QueueRow) => row.number === 949);
    expect(second?.status).toBe(MERGE_STATUS.HOLD);
    expect(second?.reasons.join(' ')).toContain('erst #948');
  });

  it('haelt bei fehlendem ACK', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), join(2, 's2'), plan.comment, ack(11, 's1', plan.hash)]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.HOLD);
    expect(queue[0].reasons.join(' ')).toContain('ACKs fehlen: 1/2');
  });

  it('ignoriert ACKs fuer eine alte Revision', () => {
    const first = planComment(10, [[948, HEAD_A]], MAIN, 1);
    const second = planComment(20, [[948, HEAD_B]], MAIN, 2);
    const events = parseMergeEvents([
      join(1, 's1'), first.comment, ack(11, 's1', first.hash),
      second.comment, ack(21, 's1', first.hash),
    ]);
    const latest = latestPlan(events);
    expect(latest?.revision).toBe(2);
    expect(validAcks(events, latest)).toHaveLength(0);
  });

  it('haelt bei main-Drift', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: OTHER_MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.HOLD);
    expect(queue[0].reasons.join(' ')).toContain('neue Revision');
  });

  it('blockiert einen geaenderten PR-Kopf', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_B]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.BLOCKED);
    expect(queue[0].reasons.join(' ')).toContain('Kopf');
  });

  it('blockiert einen PR, der im Plan fehlt', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A], [950, HEAD_B]]), events, mainSha: MAIN });
    expect(queue.find((row: QueueRow) => row.number === 950)?.status).toBe(MERGE_STATUS.BLOCKED);
  });

  it('zaehlt keine ACKs von nicht registrierten Sessions', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash), ack(12, 'fremd', plan.hash)]);
    expect(validAcks(events, latestPlan(events))).toHaveLength(1);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.READY);
  });

  it('blockiert einen manipulierten Plan', () => {
    const built = planBody({ revision: 1, mainSha: MAIN, pulls: pullsOf([[948, HEAD_A]]), at: AT });
    const tampered = comment(10, built.body.replace(`hash=${built.hash}`, 'hash=deadbeefcafe'));
    const events = parseMergeEvents([join(1, 's1'), tampered, ack(11, 's1', built.hash)]);
    const plan = latestPlan(events);
    expect(plan?.tampered).toBe(true);
    const queue = buildQueue({ plan, pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.BLOCKED);
  });

  it('nimmt eine Session erst nach LEAVE aus der Teilnehmermenge', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([
      join(1, 's1'), join(2, 's2'), plan.comment,
      ack(11, 's1', plan.hash), ack(12, 's2', plan.hash), leave(13, 's2'),
    ]);
    expect(activeSessions(events).map((entry: Session) => entry.session)).toEqual(['s1']);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.READY);
  });

  it('bindet den Plan-Hash an Reihenfolge und main-SHA', () => {
    const one = planDigest({ revision: 1, mainSha: MAIN, entries: [{ number: 1, head: HEAD_A, base: '' }] });
    const reordered = planDigest({ revision: 1, mainSha: MAIN, entries: [{ number: 2, head: HEAD_B, base: '' }] });
    const otherMain = planDigest({ revision: 1, mainSha: OTHER_MAIN, entries: [{ number: 1, head: HEAD_A, base: '' }] });
    expect(one).toHaveLength(12);
    expect(new Set([one, reordered, otherMain]).size).toBe(3);
  });

  it('verwirft ACKs ohne Kommentar-ID: der REST-Verlauf muss id mitliefern', () => {
    const plan = planComment(0, [[948, HEAD_A]]);
    const withoutId = (body: string) => ({ body, author: { login: 'vannon091118' } });
    const events = parseMergeEvents([
      withoutId('MERGE_SESSION_JOIN role=worker session=s1'),
      plan.comment,
      withoutId(`MERGE_ACK session=s1 role=worker plan=${plan.hash} main=${MAIN}`),
    ]);
    expect(events.every((event: { commentId: number }) => event.commentId === 0)).toBe(true);
    expect(validAcks(events, latestPlan(events))).toHaveLength(0);
  });

  it('ordnet Ereignisse nach Kommentar-ID, nicht nach Listenposition', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([ack(9, 's1', plan.hash), join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    expect(validAcks(events, latestPlan(events)).map((event: { session: string }) => event.session)).toEqual(['s1']);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    expect(queue[0].status).toBe(MERGE_STATUS.READY);
  });
});
