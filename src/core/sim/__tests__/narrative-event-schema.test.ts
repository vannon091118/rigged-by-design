/** @test-target: src/core/sim/narrative/event-schema.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  isEventCandidate, isEventInstance, normalizeEventState,
} from '../narrative/event-schema';

const candidate = {
  eventId: 'VISITOR_EVENT',
  priority: 5,
  scope: 'VISITOR' as const,
  participants: ['visitor:2'] as const,
  sourceFactId: 4,
  expiresInTicks: 10,
  cooldownTicks: 2,
  maxOccurrences: 2,
  step: 'START',
};

const instance = {
  id: 3,
  eventId: 'VISITOR_EVENT',
  templateId: 'VISITOR_EVENT',
  templateVersion: 1,
  offeredChoiceIds: ['ACCEPT'] as const,
  status: 'ACTIVE' as const,
  scope: 'VISITOR' as const,
  participants: ['visitor:2'] as const,
  sourceFactId: 4,
  priority: 5,
  startedTick: 1,
  updatedTick: 1,
  expiresTick: 11,
  step: 'START',
  maxOccurrences: 2,
  cooldownTicks: 2,
  chainFromEventId: null,
  resolution: null,
};

describe('Narrative Event Schema', () => {
  it('akzeptiert gueltige Kandidaten und Instanzen', () => {
    expect(isEventCandidate(candidate)).toBe(true);
    expect(isEventInstance(instance)).toBe(true);
    expect(isEventCandidate({ ...candidate, scope: 'PAIR', participants: ['visitor:1', 'visitor:2'] })).toBe(true);
    expect(isEventCandidate({ ...candidate, scope: 'GLOBAL', participants: [] })).toBe(true);
    // Engine-erzeugte Events (Tagesgrenze, Migration) haben keinen ausloesenden Fact.
    expect(isEventCandidate({ ...candidate, sourceFactId: 0 })).toBe(true);
  });

  it('verwirft falsche Scopes, Teilnehmer, Schwellen und Schritte', () => {
    expect(isEventCandidate({ ...candidate, scope: 'UNKNOWN' })).toBe(false);
    expect(isEventCandidate({ ...candidate, participants: ['staff:1'] })).toBe(false);
    expect(isEventCandidate({ ...candidate, scope: 'PAIR', participants: ['visitor:2', 'visitor:2'] })).toBe(false);
    expect(isEventCandidate({ ...candidate, priority: -1 })).toBe(false);
    expect(isEventCandidate({ ...candidate, sourceFactId: -1 })).toBe(false);
    expect(isEventCandidate({ ...candidate, cooldownTicks: -1 })).toBe(false);
    // 0 ist die Marke fuer unbegrenzt, negativ bleibt ungueltig.
    expect(isEventCandidate({ ...candidate, maxOccurrences: 0 })).toBe(true);
    expect(isEventCandidate({ ...candidate, maxOccurrences: -1 })).toBe(false);
    expect(isEventCandidate({ ...candidate, step: 'lower' })).toBe(false);
  });

  it('normalisiert fehlende Event-Daten auf sichere Defaults', () => {
    const state = normalizeEventState(undefined);
    expect(state.eventSeq).toBe(1);
    expect(state.events).toEqual([]);
    expect(state.cooldowns).toEqual([]);
    expect(state.rng.state).toBeGreaterThan(0);
  });

  it('migriert alte Instanzen ohne Template-Metadaten fail-closed', () => {
    const legacy = { ...instance } as Record<string, unknown>;
    delete legacy.templateId;
    delete legacy.templateVersion;
    delete legacy.offeredChoiceIds;
    const state = normalizeEventState({ eventSeq: 4, events: [legacy] });
    expect(state.events[0]?.templateId).toBe('VISITOR_EVENT');
    expect(state.events[0]?.templateVersion).toBe(1);
    expect(state.events[0]?.offeredChoiceIds).toEqual([]);
  });

  it('schliesst aeltere Duplikate derselben Demand-Familie', () => {
    const demand = {
      ...instance, eventId: 'NEON_NACHT', templateId: 'NEON_NACHT',
      scope: 'GLOBAL' as const, participants: [] as const,
    };
    const state = normalizeEventState({ eventSeq: 4, events: [{ ...demand, id: 1 }, { ...demand, id: 2 }] });
    expect(state.events.find((event) => event.id === 1)).toMatchObject({
      status: 'EXPIRED', resolution: 'DUPLICATE_SUPERSEDED',
    });
    expect(state.events.find((event) => event.id === 2)?.status).toBe('ACTIVE');
  });

  it('behaelt gueltige Instanzen und dedupliziert Cooldowns', () => {
    const state = normalizeEventState({
      eventSeq: 2,
      events: [instance, { ...instance, id: 9, status: 'ACTIVE', eventId: 'OTHER' }],
      cooldowns: [
        { key: 'VISITOR:X:visitor:2', eventId: 'X', untilTick: 9, lastTick: 1 },
        { key: 'VISITOR:X:visitor:2', eventId: 'X', untilTick: 12, lastTick: 2 },
      ],
      rng: { seed: 7, state: 8 },
    });
    expect(state.eventSeq).toBe(10);
    expect(state.events.map((event) => event.id)).toEqual([3, 9]);
    expect(state.cooldowns).toEqual([{ key: 'VISITOR:X:visitor:2', eventId: 'X', untilTick: 12, lastTick: 2 }]);
    expect(state.rng).toEqual({ seed: 7, state: 8 });
  });

  it('begrenzt auch manipulierte Rohdaten auf das Event-Budget', () => {
    const events = Array.from({ length: 40 }, (_, index) => ({ ...instance, id: index + 1 }));
    const state = normalizeEventState({ eventSeq: 41, events });
    expect(state.events.length).toBeLessThanOrEqual(32);
    expect(state.eventSeq).toBe(41);
  });

  it('verwirft kaputte Event- und Cooldown-Eintraege', () => {
    const state = normalizeEventState({
      eventSeq: 0,
      events: [{ ...instance, id: 0 }, { ...instance, scope: 'GLOBAL', participants: ['visitor:2'] }],
      cooldowns: [{ key: '', eventId: 'X', untilTick: -1, lastTick: 0 }],
      rng: { seed: -1, state: 0x1_0000_0000 },
    });
    expect(state.events).toEqual([]);
    expect(state.cooldowns).toEqual([]);
    expect(state.rng.seed).toBeGreaterThan(0);
    expect(state.rng.state).toBeLessThanOrEqual(0xffffffff);
    expect(isEventInstance({ ...instance, offeredChoiceIds: ['ACCEPT', 'ACCEPT'] })).toBe(false);
  });
});
