/** @test-target: src/core/sim/narrative/scheduler.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { processNarrativeBoundary } from '../narrative/boundary';
import { actorRefOfVisitor } from '../narrative/relationships';
import {
  advanceEventStep, canTransitionEvent, chainEvent, eventOccurrenceKey, scheduleCandidates,
  scheduleEvent, transitionEvent, type EventCandidate,
} from '../narrative/scheduler';
import { createWorld } from '../templates';

const globalCandidate = (eventId: string, priority = 10): EventCandidate => ({
  eventId, priority, scope: 'GLOBAL', participants: [], sourceFactId: 1,
});

const visitorCandidate = (eventId: string, visitorId: number, extra: Partial<EventCandidate> = {}): EventCandidate => ({
  eventId, priority: 10, scope: 'VISITOR', participants: [actorRefOfVisitor(visitorId)], sourceFactId: 1, ...extra,
});

describe('Narrative Event Scheduler', () => {
  it('waehlt zuerst die hoehere Prioritaet und begrenzt die Auswahl', () => {
    const world = createWorld('SMALL');
    const created = scheduleCandidates(world, [
      globalCandidate('LOW', 1),
      globalCandidate('HIGH', 50),
    ], 0);
    expect(created.map((event) => event.eventId)).toEqual(['HIGH', 'LOW']);
    expect(created.every((event) => event.status === 'OFFERED')).toBe(true);
  });

  it('ist bei gleicher Prioritaet und Historie deterministisch und nutzt den eigenen RNG', () => {
    const left = createWorld('SMALL');
    const right = createWorld('SMALL');
    const initial = left.narrative.rng.state;
    const candidates = ['A', 'B', 'C'].map((eventId) => globalCandidate(eventId));
    const first = scheduleCandidates(left, candidates, 0);
    const second = scheduleCandidates(right, candidates, 0);
    expect(first.map((event) => event.eventId)).toEqual(second.map((event) => event.eventId));
    expect(left.narrative.rng).toEqual(right.narrative.rng);
    expect(left.narrative.rng.state).not.toBe(initial);
  });

  it('trennt Scopes und verhindert Duplikate pro Event und Teilnehmerkombination', () => {
    const world = createWorld('SMALL');
    expect(scheduleEvent(world, visitorCandidate('SPEAK', 1), 'OFFERED', 0)).not.toBeNull();
    expect(scheduleEvent(world, visitorCandidate('SPEAK', 1), 'OFFERED', 0)).toBeNull();
    expect(scheduleEvent(world, visitorCandidate('SPEAK', 2), 'OFFERED', 0)).not.toBeNull();
    const pair: EventCandidate = {
      eventId: 'PAIR_EVENT', priority: 10, scope: 'PAIR',
      participants: ['visitor:1', 'visitor:2'], sourceFactId: 1,
    };
    expect(scheduleEvent(world, pair, 'OFFERED', 0)).not.toBeNull();
    expect(scheduleEvent(world, { ...pair, participants: ['visitor:2', 'visitor:1'] }, 'OFFERED', 0)).toBeNull();
    const rival: EventCandidate = {
      eventId: 'RIVAL_EVENT', priority: 10, scope: 'RIVAL', participants: ['rival:HAUS'], sourceFactId: 1,
    };
    expect(scheduleEvent(world, rival, 'OFFERED', 0)).not.toBeNull();
    expect(scheduleEvent(world, rival, 'OFFERED', 0)).toBeNull();
    expect(eventOccurrenceKey('PAIR', 'X', ['visitor:2', 'visitor:1']))
      .toBe(eventOccurrenceKey('PAIR', 'X', ['visitor:1', 'visitor:2']));
  });

  it('sperrt Cooldowns, erlaubt Wiederholung und verbietet ungueltige Lifecycle-Spruenge', () => {
    const world = createWorld('SMALL');
    const candidate = visitorCandidate('RETURN', 7, { maxOccurrences: 2, cooldownTicks: 5 });
    const first = scheduleEvent(world, candidate, 'ACTIVE', 0);
    expect(first).not.toBeNull();
    expect(transitionEvent(world, first!.id, 'RESOLVED', 2, 'DONE')).toBe(true);
    expect(scheduleEvent(world, candidate, 'ACTIVE', 2)).toBeNull();
    expect(scheduleEvent(world, candidate, 'ACTIVE', 7)).not.toBeNull();
    expect(canTransitionEvent('RESOLVED', 'ACTIVE')).toBe(false);
  });

  it('raeumt Fristen und verwaiste Teilnehmer im Boundary auf', () => {
    const world = createWorld('SMALL');
    const expiring = scheduleEvent(world, { ...globalCandidate('DEADLINE', 1), expiresInTicks: 0 }, 'ACTIVE', 0);
    const stale = scheduleEvent(world, visitorCandidate('STALE', 99), 'ACTIVE', 0);
    expect(expiring).not.toBeNull();
    expect(stale).not.toBeNull();
    processNarrativeBoundary(world, new Ledger());
    const events = world.narrative.events;
    expect(events.find((event) => event.id === expiring!.id)?.status).toBe('EXPIRED');
    expect(events.find((event) => event.id === stale!.id)?.resolution).toBe('MISSING_PARTICIPANT');
  });

  it('verkettet nur aufgeloeste Events und erlaubt einen Schrittwechsel', () => {
    const world = createWorld('SMALL');
    const prior = scheduleEvent(world, globalCandidate('PRIOR', 10), 'ACTIVE', 0)!;
    expect(chainEvent(world, prior.id, globalCandidate('FOLLOW', 10), 0)).toBeNull();
    expect(transitionEvent(world, prior.id, 'RESOLVED', 1, 'OK')).toBe(true);
    const follow = chainEvent(world, prior.id, globalCandidate('FOLLOW', 10), 2);
    expect(follow?.chainFromEventId).toBe(prior.id);
    expect(advanceEventStep(world, follow!.id, 'NEXT_STEP', 2)).toBe(true);
    expect(world.narrative.events.find((event) => event.id === follow!.id)?.step).toBe('NEXT_STEP');
  });

  it('begrenzt die abgeschlossene Historie, ohne die Event-ID zurueckzusetzen', () => {
    const world = createWorld('SMALL');
    for (let index = 0; index < 40; index += 1) {
      const event = scheduleEvent(world, globalCandidate(`EVENT_${index}`, 1), 'ACTIVE', index);
      expect(event).not.toBeNull();
      expect(transitionEvent(world, event!.id, 'RESOLVED', index, 'OK')).toBe(true);
    }
    expect(world.narrative.events.length).toBeLessThanOrEqual(32);
    expect(world.narrative.eventSeq).toBe(41);
  });
});
