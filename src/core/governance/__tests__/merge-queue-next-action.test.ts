/**
 * @test-target: scripts/lib/merge-queue.mjs
 * @error-code: ERR-4029
 *
 * Der leere Zustand ist ein eigener Zustand: ohne offenen PR gibt es keine
 * Bestaetigung und keinen Merge. Die eine naechste Aktion ist dann der
 * Board-Check — nie ein ACK auf einen PR, den es nicht gibt.
 */
import { describe, expect, it } from 'vitest';
import {
  QUEUE_IDLE_COMMAND,
  QUEUE_STATE,
  buildQueue,
  latestPlan,
  nextAction,
  parseMergeEvents,
  planBody,
} from '../../../../scripts/lib/merge-queue.mjs';

const MAIN = 'a'.repeat(40);
const HEAD_A = '1'.repeat(40);
const HEAD_B = '2'.repeat(40);
const AT = '2026-11-16T03:00:00Z';

const comment = (id: number, body: string) => ({ id, body, user: { login: 'vannon091118' } });
const pullsOf = (entries: [number, string][]) => entries.map(([number, head]) => ({ number, headRefOid: head }));
const join = (id: number, session: string, role = 'worker') =>
  comment(id, `MERGE_SESSION_JOIN role=${role} session=${session} at=${AT}`);
const ack = (id: number, session: string, hash: string) =>
  comment(id, `MERGE_ACK session=${session} role=worker plan=${hash} main=${MAIN} at=${AT}`);

/** Ein Plan-Kommentar, wie ihn `--publish` schreibt. */
function planComment(id: number, pulls: [number, string][], mainSha = MAIN, revision = 1) {
  const built = planBody({ revision, mainSha, pulls: pullsOf(pulls), at: AT });
  return { comment: comment(id, built.body), hash: built.hash };
}

/**
 * Der leere Zustand ist ein eigener Zustand: ohne offenen PR gibt es keine
 * Bestaetigung und keinen Merge. Die eine naechste Aktion ist dann der
 * Board-Check — nie ein ACK auf einen PR, den es nicht gibt.
 */
describe('naechste Aktion je Queue-Zustand', () => {
  it('leere Queue: Board-Check statt ACK', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    const action = nextAction({ plan: latestPlan(events), queue: [], events, session: 's1', mainSha: MAIN });
    expect(action.state).toBe(QUEUE_STATE.IDLE);
    expect(action.command).toBe(QUEUE_IDLE_COMMAND);
    expect(action.command).not.toContain('--ack');
    expect(action.command).not.toContain('--publish');
  });

  it('leere Queue bleibt IDLE, auch ohne Plan und ohne Session', () => {
    const action = nextAction({ queue: [], events: [], session: 's1', mainSha: MAIN });
    expect(action.state).toBe(QUEUE_STATE.IDLE);
    expect(action.command).toBe(QUEUE_IDLE_COMMAND);
  });

  it('nicht leere Queue ohne Plan: neue Revision veroeffentlichen', () => {
    const queue = buildQueue({ plan: null, pulls: pullsOf([[948, HEAD_A]]), events: [], mainSha: MAIN });
    const action = nextAction({ plan: null, queue, events: [], session: 's1', mainSha: MAIN });
    expect(action.state).toBe(QUEUE_STATE.PLAN_MISSING);
    expect(action.command).toBe('pnpm run merge:queue -- --publish');
  });

  it('nicht leere Queue mit Plan ohne ACK: Bestaetigung dieser Session', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A]]), events, mainSha: MAIN });
    const action = nextAction({ plan: latestPlan(events), queue, events, session: 's1', mainSha: MAIN });
    expect(action.state).toBe(QUEUE_STATE.ACK_MISSING);
    expect(action.command).toBe('pnpm run merge:queue -- --ack --session s1 --role worker');
  });

  it('nicht leere Queue, Position 1 bestaetigt: Merge auf exakt diesen Kopf', () => {
    const plan = planComment(10, [[948, HEAD_A]]);
    const events = parseMergeEvents([join(1, 's1'), plan.comment, ack(11, 's1', plan.hash)]);
    const queue = buildQueue({ plan: latestPlan(events), pulls: pullsOf([[948, HEAD_A], [950, HEAD_B]]), events, mainSha: MAIN });
    const action = nextAction({ plan: latestPlan(events), queue, events, session: 's1', mainSha: MAIN });
    expect(action.state).toBe(QUEUE_STATE.READY);
    expect(action.command).toBe(`gh pr merge 948 --squash --match-head-commit ${HEAD_A}`);
  });
});
