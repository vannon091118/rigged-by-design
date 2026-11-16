/**
 * @test-target: scripts/lib/webhook-action.mjs
 * @error-code: ERR-4029
 *
 * Eine Delivery darf keine eigene Wahrheit erzeugen: fuer denselben Verlauf
 * und dieselben offenen PRs muss sie denselben Befehl liefern wie der CLI-Weg.
 */
import { describe, expect, it } from 'vitest';
import { PLAN_DELIVERY, PR_DELIVERY } from './webhook-fixture';
import { deliveryPlanned, deliverySubject, touchesMergeThread } from '../../../../scripts/lib/webhook-action.mjs';
import { buildQueue, latestPlan, nextAction, parseMergeEvents } from '../../../../scripts/lib/merge-queue.mjs';

const MAIN = 'a'.repeat(40);
const HEAD = '2c1599b1b2358d4efff3f6ddcf90974311e5b600';
const pullsOf = (entries: [number, string][]) => entries.map(([number, head]) => ({ number, headRefOid: head }));

describe('webhook-action', () => {
  it('erkennt nur Merge-Ereignisse am Merge-Issue als Verlauf', () => {
    const plan = PLAN_DELIVERY;
    expect(touchesMergeThread({ event: 'issue_comment', payload: plan })).toBe(true);
    expect(touchesMergeThread({ event: 'issue_comment', payload: { ...PLAN_DELIVERY, comment: { body: 'nur ein Kommentar' } } })).toBe(false);
    expect(touchesMergeThread({ event: 'issues', payload: plan })).toBe(false);
  });

  it('liest PR-Ereignisse als Subjekt, ohne daraus eine Entscheidung zu machen', () => {
    const pr = PR_DELIVERY;
    expect(deliverySubject({ event: 'pull_request', payload: pr })).toEqual({
      kind: 'pull-request', number: 953, action: 'opened', merged: false, head: HEAD,
    });
  });

  it('liefert fuer dieselben Eingaben denselben Befehl wie der CLI-Weg', () => {
    const plan = PLAN_DELIVERY;
    const pulls = pullsOf([[952, '8832094070376fa0c4d3bace8d5c7ed6f8069b56']]);
    const planned = deliveryPlanned({
      event: 'issue_comment', payload: plan, comments: [], pulls, mainSha: MAIN, session: 's1',
    });
    // Derselbe Zustand, direkt gerechnet - ohne Webhook.
    const comments = [plan.comment];
    const events = parseMergeEvents(comments);
    const reference = nextAction({
      plan: latestPlan(events), queue: buildQueue({ plan: latestPlan(events), pulls, events, mainSha: MAIN }),
      events, session: 's1', mainSha: MAIN,
    });
    expect(planned.action).toEqual(reference);
    expect(planned.plan?.hash).toBe(PLAN_DELIVERY.comment.body.split('hash=')[1]?.split(' ')[0]);
  });

  it('bleibt ohne Verlauf im leeren Zustand: Board-Check, kein ACK', () => {
    const planned = deliveryPlanned({ event: 'pull_request', payload: PR_DELIVERY, comments: [], pulls: [], mainSha: MAIN });
    expect(planned.action.state).toBe('IDLE');
    expect(planned.action.command).toBe('pnpm run board:sync -- --check');
  });
});
