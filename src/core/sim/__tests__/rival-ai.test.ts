/**
 * @test-target: src/core/sim/rival-ai/policy.ts
 * @error-code: ERR-2001
 *
 * Rivalen handeln deterministisch: gleiche Eingaben, gleiche Absicht. Sabotage
 * trifft genau ein Geraet, hinterlaesst ein Indiz und einen RIVAL_ACTION-Fact;
 * ein Guard verhindert den Schaden, nicht das Indiz.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { processNarrativeBoundary } from '../narrative/boundary';
import { actorRefOfRival, relationshipBetween } from '../narrative/relationships';
import { isFact } from '../narrative/fact-schema';
import type { VaCoinMicro } from '../../economy/vacoin';
import { EVENT_TEMPLATES, templateFor } from '../narrative/events/definitions';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { applyRivalAction, sabotageTarget } from '../rival-ai/actions';
import { createRivalMinds, normalizeRivalMinds } from '../rival-ai/minds';
import { decideRivalAction, type RivalPolicyInput } from '../rival-ai/policy';
import { tickRivalMinds } from '../rival-ai/tick';
import { createWorld } from '../templates';
import type { StaffAgent } from '../types';

const GUARD: StaffAgent = {
  id: 700, role: 'guard', x: 5, y: 5, path: [], pathIndex: 0, carryingCrate: null,
  workTicks: 0, task: 'patrol', blockedReason: '', targetDisputeId: null,
};

const input = (overrides: Partial<RivalPolicyInput> = {}): RivalPolicyInput => ({
  tick: 400, stance: 'NEUTRAL', capacity: 80, goodwill: -30, nextActionTick: 0,
  counteredUntilTick: 0, rivalReputation: 40, playerReputation: 30, guestsServed: 40,
  evidenceCount: 0, recentNetToHouse: 0, machineId: 101,
  ...overrides,
});

describe('Rivalen-Politik', () => {
  it('entscheidet ohne Zufall und respektiert Takt und Gegenmassnahme', () => {
    expect(decideRivalAction(input())).toEqual(decideRivalAction(input()));
    expect(decideRivalAction(input({ tick: 100 }))).toBeNull();
    expect(decideRivalAction(input({ nextActionTick: 401 }))).toBeNull();
    expect(decideRivalAction(input({ counteredUntilTick: 500 }))).toBeNull();
  });

  it('waehlt je Lage genau eine erklaerte Absicht', () => {
    expect(decideRivalAction(input({ capacity: 10 }))?.action).toBe('PROBE');
    expect(decideRivalAction(input({ goodwill: 40 }))?.action).toBe('TRADE_INFO');
    expect(decideRivalAction(input({ recentNetToHouse: 500 }))?.action).toBe('SABOTAGE');
    expect(decideRivalAction(input({ evidenceCount: 2 }))?.action).toBe('SABOTAGE');
    expect(decideRivalAction(input({ playerReputation: 60 }))?.action).toBe('PRICE_MOVE');
    expect(decideRivalAction(input({ machineId: null, playerReputation: 0 }))?.action).toBe('PROBE');
  });
});

describe('Rivalen-Sabotage mit Indizien', () => {
  it('beschaedigt genau ein Geraet und belegt die Tat', () => {
    const world = createWorld('SMALL');
    const mind = createRivalMinds()[0]!;
    const target = sabotageTarget(world);
    expect(target).not.toBeNull();
    const machine = world.furniture.find((item) => item.id === target)!;
    const before = machine.condition;
    applyRivalAction(world, mind, decideRivalAction(input({ machineId: target, recentNetToHouse: 500 }))!);
    expect(machine.damaged).toBe(true);
    expect(machine.condition).toBe(Math.max(0, before - 12));
    expect(mind.evidence).toHaveLength(1);
    expect(mind.evidence[0]?.blocked).toBe(false);
    expect(mind.evidence[0]?.machineId).toBe(target);
    expect(mind.history.map((entry) => entry.action)).toEqual(['SABOTAGE']);
    expect(mind.stance).toBe('HOSTILE');
    expect(world.journal[world.journal.length - 1]?.kind).toBe('RIVAL');
    const fact = world.narrative.pending[world.narrative.pending.length - 1];
    expect(fact?.kind).toBe('RIVAL_ACTION');
    expect(isFact(fact)).toBe(true);
  });

  it('laesst den Guard den Schaden verhindern, nicht das Indiz', () => {
    const world = createWorld('SMALL');
    world.agents.push({ ...GUARD });
    const mind = createRivalMinds()[1]!;
    const target = sabotageTarget(world);
    const machine = world.furniture.find((item) => item.id === target)!;
    const before = machine.condition;
    applyRivalAction(world, mind, decideRivalAction(input({ machineId: target, recentNetToHouse: 500 }))!);
    expect(machine.condition).toBe(before);
    expect(machine.damaged).toBe(false);
    expect(mind.evidence[0]?.blocked).toBe(true);
  });

  it('haelt den ersten Tick rivalenfrei', () => {
    const world = createWorld('SMALL');
    expect(tickRivalMinds(world)).toEqual([]);
    expect(world.narrative.pending).toEqual([]);
  });

  it('normalisiert gespeicherte Zustaende auf drei bekannte Rivalen', () => {
    const minds = normalizeRivalMinds([
      {
        rivalId: 'HAFENKLAUSE', stance: 'UNKNOWN', capacity: 9_999, goodwill: -9_999,
        evidence: [{ action: 'SABOTAGE', tick: -5, day: 1, machineId: 4, blocked: true, note: 'x' }],
      },
      { rivalId: 'UNBEKANNT', capacity: 50 },
    ]);
    expect(minds.map((mind) => mind.rivalId)).toEqual(['HAFENKLAUSE', 'GOLDENE_HAND', 'NEBELPALAST']);
    expect(minds[0]?.stance).toBe('NEUTRAL');
    expect(minds[0]?.capacity).toBe(100);
    expect(minds[0]?.goodwill).toBe(-100);
    expect(minds[0]?.evidence[0]?.tick).toBe(0);
    expect(minds[1]?.capacity).toBe(60);
  });

  it('verdrahtet Tick, Fact und Beziehung ueber den Boundary', () => {
    const world = createWorld('SMALL');
    world.tick = 400;
    const mind = world.rivals[0]!;
    mind.capacity = 80;
    mind.goodwill = -30;
    mind.nextActionTick = 0;
    world.narrative.recent.push({
      id: 1, tick: 390, day: 3, kind: 'RIVAL_ENCOUNTER',
      actorRefs: ['rival:HAFENKLAUSE', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: 5_000 as VaCoinMicro,
    });
    const acted = tickRivalMinds(world);
    expect(acted[0]?.action).toBe('SABOTAGE');
    processNarrativeBoundary(world, new Ledger());
    const edge = relationshipBetween(world, actorRefOfRival('HAFENKLAUSE'), 'player');
    expect(edge?.conflict).toBeGreaterThan(0);
    expect(world.narrative.pending.filter((fact) => fact.kind === 'RIVAL_ACTION')).toHaveLength(0);
  });
});

describe('Rivalen-Trigger', () => {
  it('uebersetzt eine Rivalenhandlung in einen RIVAL_MOVE-Kandidaten', () => {
    const template = templateFor('RIVAL_MOVE');
    expect(template).not.toBeNull();
    expect(EVENT_TEMPLATES.some((entry) => entry.eventId === 'RIVAL_MOVE')).toBe(true);
    const candidate = createEventCandidate(template!, {
      triggerId: 'rival-action', matched: true, factId: 1,
      participants: ['rival:HAFENKLAUSE'], reasons: ['TEST'],
    });
    expect(candidate?.participants).toEqual(['rival:HAFENKLAUSE']);
    expect(candidate?.offeredChoiceIds).toEqual(['CONFRONT_RIVAL', 'WATCH_THE_MOVE']);
  });

  it('akzeptiert nur RIVAL_ACTION-Facts mit passender Rivalenreferenz', () => {
    const base = {
      id: 1, tick: 0, day: 0, kind: 'RIVAL_ACTION' as const, rivalId: 'GOLDENE_HAND' as const,
      action: 'SABOTAGE' as const, evidence: true, machineId: 4,
    };
    expect(isFact({ ...base, actorRefs: ['rival:GOLDENE_HAND'] })).toBe(true);
    expect(isFact({ ...base, machineId: null, actorRefs: ['rival:GOLDENE_HAND'] })).toBe(true);
    expect(isFact({ ...base, actorRefs: ['rival:GOLDENE_HAND', 'player'] })).toBe(false);
    expect(isFact({ ...base, actorRefs: ['rival:HAFENKLAUSE'] })).toBe(false);
    expect(isFact({ ...base, action: 'UNKNOWN', actorRefs: ['rival:GOLDENE_HAND'] })).toBe(false);
  });
});
