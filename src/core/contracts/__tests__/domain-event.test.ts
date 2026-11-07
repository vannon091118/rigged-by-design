/**
 * @test-target: src/core/contracts/domain-event.ts
 * @error-code: ERR-1002
 *
 * Contract domain-event v1.0: Event-Hülle mit Actor-/Zeit-Referenzen, Sequenz
 * und Payload-Version. Der Kollisionstest belegt, dass zwei gleichartige Events
 * im selben Tick für denselben Akteur verschiedene IDs tragen.
 */
import { describe, expect, it } from 'vitest';
import type { DomainEvent, EventId } from '../domain-event';
import { createDomainEvent, domainEventId, validateDomainEvent } from '../domain-event';

describe('Contract: domain-event v1.0', () => {
  const actorId = 'guest_42';
  const tick = 1200;
  const day = 2;

  it('erstellt eine valide Domain-Event-Hülle mit Sequenz in der ID', () => {
    const event = createDomainEvent({
      eventType: 'VISIT_ARRIVED',
      tick,
      day,
      actorId,
      sequence: 0,
      payloadVersion: 1,
      payload: { guestId: 42 },
    });
    expect(event.eventId).toBe('VISIT_ARRIVED:1200:guest_42:0');
    expect(event.sequence).toBe(0);
  });

  it('trennt zwei gleichartige Events im selben Tick über die Sequenz', () => {
    const first = createDomainEvent({
      eventType: 'VISITOR_SERVICE',
      tick,
      day,
      actorId,
      sequence: 0,
      payloadVersion: 1,
      payload: { amount: 1 },
    });
    const second = createDomainEvent({
      eventType: 'VISITOR_SERVICE',
      tick,
      day,
      actorId,
      sequence: 1,
      payloadVersion: 1,
      payload: { amount: 1 },
    });
    expect(second.eventId).not.toBe(first.eventId);
  });

  it('validiert eine korrekte Hülle', () => {
    const event: DomainEvent = createDomainEvent({
      eventType: 'TEST',
      tick: 0,
      day: 0,
      actorId: 'player_1',
      sequence: 3,
      payloadVersion: 1,
      payload: {},
    });
    expect(validateDomainEvent(event)).toBe(true);
  });

  it('lehnt eine eventId ab, die nicht aus den Feldern folgt', () => {
    const event = createDomainEvent({
      eventType: 'TEST',
      tick,
      day,
      actorId,
      sequence: 4,
      payloadVersion: 1,
      payload: {},
    });
    const forged: EventId = 'TEST:1200:guest_42:999';
    expect(validateDomainEvent({ ...event, eventId: forged })).toBe(false);
  });

  it('weist leere actorId beim Bauen ab', () => {
    expect(() =>
      createDomainEvent({
        eventType: 'TEST',
        tick,
        day,
        actorId: '',
        sequence: 0,
        payloadVersion: 1,
        payload: {},
      }),
    ).toThrow();
  });

  it('weist negative Sequenzen beim Bauen ab', () => {
    expect(() => domainEventId('TEST', tick, actorId, -1)).toThrow();
  });

  it('weist nicht-ganzzahlige Ticks beim Bauen ab', () => {
    expect(() => domainEventId('TEST', 1.5, actorId, 0)).toThrow();
  });

  it('hält die Hülle unveränderlich', () => {
    const event = createDomainEvent({
      eventType: 'TEST',
      tick,
      day,
      actorId,
      sequence: 0,
      payloadVersion: 1,
      payload: {},
    });
    expect(Object.isFrozen(event)).toBe(true);
  });
});
