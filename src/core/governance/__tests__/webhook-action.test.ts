/**
 * @test-target: scripts/lib/webhook-action.mjs
 * @error-code: ERR-4029
 *
 * Eine Delivery darf keine eigene Wahrheit erzeugen. Nach dem Queue-Rueckbau
 * bleibt die Einordnung des Subjekts: Art, Nummer, Aktion, Kopf — nicht mehr.
 */
import { describe, expect, it } from 'vitest';
import { PLAN_DELIVERY, PR_DELIVERY } from './webhook-fixture';
import { deliverySubject } from '../../../../scripts/lib/webhook-action.mjs';

const HEAD = '2c1599b1b2358d4efff3f6ddcf90974311e5b600';

describe('webhook-action', () => {
  it('liest PR-Ereignisse als Subjekt, ohne daraus eine Entscheidung zu machen', () => {
    expect(deliverySubject({ event: 'pull_request', payload: PR_DELIVERY })).toEqual({
      kind: 'pull-request', number: 953, action: 'opened', merged: false, head: HEAD,
    });
  });

  it('ordnet Issue-Kommentare mit Nummer und Kommentar-ID ein', () => {
    expect(deliverySubject({ event: 'issue_comment', payload: PLAN_DELIVERY })).toEqual({
      kind: 'issue-comment', number: 913, action: 'created', commentId: 6905796238,
    });
  });

  it('ordnet unbekannte Ereignisse als other ein, ohne Nummer zu raten', () => {
    expect(deliverySubject({ event: 'push', payload: { ref: 'refs/heads/main' } })).toEqual({
      kind: 'other', number: null, action: '',
    });
  });
});
