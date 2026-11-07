/**
 * @test-target: src/core/contracts/domain-event.ts
 * @error-code: ERR-1002
 *
 * Contract domain-event v1.0: Event-Hülle mit Actor-/Zeit-Referenzen und Payload-Version.
 */
import { describe, expect, it } from 'vitest';
import type { DomainEvent, EventId, PayloadVersion } from '../domain-event';
import { createDomainEvent, validateDomainEvent } from '../domain-event';

describe('Contract: domain-event v1.0', () => {
  const actorId = 'guest_42';
  const tick = 1200;
  const day = 2;

  it('erstellt eine valide Domain-Event-Hülle', () => {
    const event = createDomainEvent(actorId, tick, day, 'VISIT_ARRIVED', 1, { guestId: 42 });
    expect(event.eventId).toBe('VISIT_ARRIVED:1200:guest_42');
    expect(event.actorId).toBe(actorId);
    expect(event.tick).toBe(tick);
    expect(event.day).toBe(day);
    expect(event.eventType).toBe('VISIT_ARRIVED');
    expect(event.payloadVersion).toBe(1);
    expect(event.payload).toEqual({ guestId: 42 });
  });

  it('validiert eine korrekte Hülle', () => {
    const event: DomainEvent = createDomainEvent('player_1', 0, 0, 'TEST', 1, {});
    expect(event.eventId).toBe('TEST:0:player_1');
    expect(validateDomainEvent(event)).toBe(true);
  });

  it('lehnt leere eventId ab', () => {
    const event: EventId = '';
    const result = createDomainEvent(actorId, tick, day, 'TEST', 1, {});
    expect(validateDomainEvent({ ...result, eventId: event })).toBe(false);
  });

  it('lehnt leeren actorId ab', () => {
    const result = createDomainEvent('', tick, day, 'TEST', 1, {});
    expect(validateDomainEvent(result)).toBe(false);
  });

  it('lehnt negativen tick ab', () => {
    const result = createDomainEvent(actorId, -1, day, 'TEST', 1, {});
    expect(validateDomainEvent(result)).toBe(false);
  });

  it('lehnt payloadVersion 0 ab', () => {
    const version: PayloadVersion = 0;
    const result = createDomainEvent(actorId, tick, day, 'TEST', version, {});
    expect(validateDomainEvent(result)).toBe(false);
  });

  it('produziert deterministische eventId für gleiche Eingaben', () => {
    const e1 = createDomainEvent(actorId, tick, day, 'VISIT_ARRIVED', 1, { x: 1 });
    const e2 = createDomainEvent(actorId, tick, day, 'VISIT_ARRIVED', 1, { x: 1 });
    expect(e1.eventId).toBe(e2.eventId);
  });
});
