/**
 * @test-target: src/core/sim/narrative/chains/chain-runtime.ts
 * @error-code: ERR-2001
 *
 * Die Kette darf nur aus aufgeloesten Events starten, je nach Matrixwerten
 * andere Pfade waehlen, bei Verzoegerung ruhen, bei Abbruch enden und nach
 * Save/Load denselben Zustand fortsetzen. Keine Rekursion, kein globaler RNG.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { INFLUENCE_CONFIG } from '../influence';
import { HAUSKONTO } from '../money';
import { offerChoiceIds } from '../narrative/choices/contract';
import { chainContext } from '../narrative/chains/chain-context';
import { evaluateChainCondition } from '../narrative/chains/chain-conditions';
import { advanceChains } from '../narrative/chains/chain-runtime';
import type { ChainCondition, ChainRun } from '../narrative/chains/chain-types';
import { transitionEvent } from '../narrative/event-lifecycle';
import { scheduleEvent } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import type { EventCandidate } from '../narrative/event-types';
import { emitFact } from '../narrative/facts';
import { recordFirstHand } from '../narrative/knowledge';
import { normalizeNarrativeState } from '../narrative/state';
import { shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

const EMPTY = new Set<number>();

function resolveEvent(
  world: ReturnType<typeof createWorld>,
  eventId: string,
  participants: readonly `visitor:${number}`[],
  outcomeId: string,
  tick: number,
  choiceId = 'TEST_CHOICE',
) {
  const template = templateFor(eventId)!;
  const candidate: EventCandidate = {
    eventId, templateId: eventId, templateVersion: template.version,
    offeredChoiceIds: [...offerChoiceIds(template)], priority: template.priority,
    scope: template.scope, participants, sourceFactId: 1,
    expiresInTicks: template.expiresInTicks, cooldownTicks: 0,
    maxOccurrences: 0, chainFromEventId: null, step: template.initialStep,
  };
  const event = scheduleEvent(world, candidate, 'OFFERED', tick)!;
  transitionEvent(world, event.id, 'ACTIVE', tick);
  transitionEvent(world, event.id, 'RESOLVED', tick, outcomeId);
  emitFact(world, {
    kind: 'EVENT_RESOLVED', eventId: event.id, eventKind: eventId, choiceId, outcomeId,
  });
  return event;
}

function warmFixture(trust: number, sympathy: number) {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Ketten-Gast', persona: 'STAMMGAST', tick: 0 });
  const ref = `visitor:${visitor.id}` as const;
  shift(world, ref, 'player', { trust, sympathy }, 0);
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const event = resolveEvent(world, 'VISITOR_RETURN_WARM', [ref], 'WARMED', 0, 'WARM_WELCOME');
  return { world, ledger, ref, event };
}

function activeRuns(world: ReturnType<typeof createWorld>): ChainRun[] {
  return world.narrative.chains.runs.filter((run) => run.status === 'RUNNING' || run.status === 'WAITING');
}

describe('Ereignisketten-Laufzeit', () => {
  it('startet aus der warmen Rueckkehr und waehlt bei hoher Matrix den direkten Nachspiel-Knoten', () => {
    const { world, ledger, event } = warmFixture(10, 10);
    const result = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    expect(result.started).toBe(1);
    expect(result.scheduled.map((entry) => entry.eventId)).toEqual(['VISITOR_AFTERMATH']);
    const run = activeRuns(world)[0]!;
    expect(run.nodeId).toBe('AFTERMATH');
    expect(run.steps).toBe(2);
    expect(run.eventInstanceId).toBe(result.scheduled[0]!.id);
  });

  it('waehlt bei niedriger Matrix einen ruhenden Echo-Pfad und plant ihn erst zur Faelligkeit', () => {
    const { world, ledger, event, ref } = warmFixture(-10, -10);
    const result = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    expect(result.scheduled).toEqual([]);
    const waiting = activeRuns(world)[0]!;
    expect(waiting.status).toBe('WAITING');
    expect(waiting.nodeId).toBe('ECHO');
    expect(waiting.dueTick).toBe(6);
    expect(waiting.pendingEdgeId).toBe('WARM_TO_ECHO');
    expect(advanceChains(world, ledger, 5, INFLUENCE_CONFIG, EMPTY).scheduled).toEqual([]);
    const later = advanceChains(world, ledger, 6, INFLUENCE_CONFIG, EMPTY);
    expect(later.scheduled.map((entry) => entry.eventId)).toEqual(['CHAIN_VISITOR_ECHO']);
    expect(later.scheduled[0]!.participants).toEqual([ref]);
  });

  it('fuehrt den hohen Pfad nach dem Nachspiel in ein zeitversetztes Echo', () => {
    const { world, ledger, event } = warmFixture(10, 10);
    const first = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    const aftermath = first.scheduled[0]!;
    transitionEvent(world, aftermath.id, 'ACTIVE', 5);
    transitionEvent(world, aftermath.id, 'RESOLVED', 5, 'LISTENED');
    emitFact(world, {
      kind: 'EVENT_RESOLVED', eventId: aftermath.id, eventKind: 'VISITOR_AFTERMATH',
      choiceId: 'LISTEN_ON', outcomeId: 'LISTENED',
    });
    const second = advanceChains(world, ledger, 5, INFLUENCE_CONFIG, new Set([aftermath.id]));
    expect(second.scheduled).toEqual([]);
    const waiting = activeRuns(world)[0]!;
    expect(waiting.status).toBe('WAITING');
    expect(waiting.dueTick).toBe(17);
    const third = advanceChains(world, ledger, 17, INFLUENCE_CONFIG, EMPTY);
    expect(third.scheduled.map((entry) => entry.eventId)).toEqual(['CHAIN_VISITOR_ECHO']);
  });

  it('prueft die Uebergangsbedingung bei Faelligkeit erneut und verwirft sie bei geaendertem Zustand', () => {
    const { world, ledger, event, ref } = warmFixture(10, 10);
    const first = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    const aftermath = first.scheduled[0]!;
    transitionEvent(world, aftermath.id, 'ACTIVE', 5);
    transitionEvent(world, aftermath.id, 'RESOLVED', 5, 'LISTENED');
    emitFact(world, {
      kind: 'EVENT_RESOLVED', eventId: aftermath.id, eventKind: 'VISITOR_AFTERMATH',
      choiceId: 'LISTEN_ON', outcomeId: 'LISTENED',
    });
    advanceChains(world, ledger, 5, INFLUENCE_CONFIG, new Set([aftermath.id]));
    shift(world, ref, 'player', { trust: -10 }, 6);
    const later = advanceChains(world, ledger, 17, INFLUENCE_CONFIG, EMPTY);
    expect(later.scheduled).toEqual([]);
    expect(world.narrative.chains.runs[0]?.status).toBe('COMPLETED');
    expect(world.narrative.chains.runs[0]?.reason).toBe('EDGE_INVALIDATED');
  });

  it('bricht eine ruhende Kette ab, wenn die Abbruchbedingung am Knoten eintritt', () => {
    const { world, ledger, event, ref } = warmFixture(-10, -10);
    advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    shift(world, ref, 'player', { conflict: 5 }, 2);
    const later = advanceChains(world, ledger, 6, INFLUENCE_CONFIG, EMPTY);
    expect(later.scheduled).toEqual([]);
    expect(later.aborted).toBe(1);
    expect(world.narrative.chains.runs[0]?.status).toBe('ABORTED');
    expect(world.narrative.chains.runs[0]?.reason).toBe('ABORT_CONDITION');
  });

  it('bricht ab, wenn die laufende Instanz vor der Aufloesung verfaellt oder abgebrochen wird', () => {
    const { world, ledger, event } = warmFixture(10, 10);
    const first = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    transitionEvent(world, first.scheduled[0]!.id, 'CANCELLED', 2, 'MISSING_PARTICIPANT');
    const later = advanceChains(world, ledger, 3, INFLUENCE_CONFIG, EMPTY);
    expect(later.scheduled).toEqual([]);
    expect(world.narrative.chains.runs[0]?.status).toBe('ABORTED');
    expect(world.narrative.chains.runs[0]?.reason).toBe('INTERRUPTED');
  });

  it('setzt einen ruhenden Lauf nach Save/Load mit demselben Ziel fort', () => {
    const { world, ledger, event } = warmFixture(-10, -10);
    advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    world.narrative = normalizeNarrativeState(JSON.parse(JSON.stringify(world.narrative)));
    world.tick = 6;
    const resumed = advanceChains(world, ledger, 6, INFLUENCE_CONFIG, EMPTY);
    expect(resumed.scheduled.map((entry) => entry.eventId)).toEqual(['CHAIN_VISITOR_ECHO']);
    expect(world.narrative.chains.runs.filter((run) => run.status === 'RUNNING')).toHaveLength(1);
  });

  it('startet dieselbe nicht wiederholbare Kette fuer denselben Gast kein zweites Mal', () => {
    const { world, ledger, event, ref } = warmFixture(-10, -10);
    advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([event.id]));
    world.tick = 30;
    const second = resolveEvent(world, 'VISITOR_RETURN_WARM', [ref], 'WARMED', 30, 'WARM_WELCOME');
    const result = advanceChains(world, ledger, 30, INFLUENCE_CONFIG, new Set([second.id]));
    expect(result.started).toBe(0);
    expect(world.narrative.chains.runs).toHaveLength(1);
    // Der eine geplante Echo-Knoten gehoert zum urspruenglichen Lauf, nicht zu einem zweiten Start.
    expect(result.scheduled.map((entry) => entry.eventId)).toEqual(['CHAIN_VISITOR_ECHO']);
    expect(world.narrative.chains.runs[0]?.eventInstanceId).toBe(result.scheduled[0]?.id);
  });

  it('teilt einen eskalierte Paar-Konflikt in zwei unabhaengige Echos', () => {
    const world = createWorld('SMALL');
    const first = recordVisitor(world, { name: 'Streit A', persona: 'STAMMGAST', tick: 0 });
    const second = recordVisitor(world, { name: 'Streit B', persona: 'BUSINESS', tick: 0 });
    const refs = [`visitor:${first.id}`, `visitor:${second.id}`] as const;
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    const conflict = resolveEvent(world, 'VISITOR_CONFLICT', refs, 'ESCALATED', 0, 'ESCALATE');
    const forked = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([conflict.id]));
    expect(forked.scheduled).toEqual([]);
    expect(world.narrative.chains.runs.find((run) => run.reason === 'FORK')?.status).toBe('COMPLETED');
    expect(activeRuns(world)).toHaveLength(2);
    const later = advanceChains(world, ledger, 8, INFLUENCE_CONFIG, EMPTY);
    expect(later.scheduled.map((entry) => entry.eventId)).toEqual(['CHAIN_VISITOR_ECHO', 'CHAIN_VISITOR_ECHO']);
    expect(later.scheduled.map((entry) => entry.participants[0]).sort()).toEqual([...refs].sort());
  });

  it('beendet einen entschaerften Paar-Konflikt ohne Folgeknoten', () => {
    const world = createWorld('SMALL');
    const first = recordVisitor(world, { name: 'Ruhe A', persona: 'STAMMGAST', tick: 0 });
    const second = recordVisitor(world, { name: 'Ruhe B', persona: 'BUSINESS', tick: 0 });
    const refs = [`visitor:${first.id}`, `visitor:${second.id}`] as const;
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    const conflict = resolveEvent(world, 'VISITOR_CONFLICT', refs, 'DEFUSED', 0, 'DEFUSE');
    const result = advanceChains(world, ledger, 0, INFLUENCE_CONFIG, new Set([conflict.id]));
    expect(result.scheduled).toEqual([]);
    expect(world.narrative.chains.runs[0]?.status).toBe('COMPLETED');
    expect(world.narrative.chains.runs[0]?.reason).toBe('END');
  });

  it('gewaehrt Wissen nur dem Akteur, der es tatsaechlich erworben hat', () => {
    const world = createWorld('SMALL');
    const owner = recordVisitor(world, { name: 'Wissend', persona: 'STAMMGAST', tick: 0 });
    const stranger = recordVisitor(world, { name: 'Fremd', persona: 'STREET', tick: 0 });
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    const ownerRef = `visitor:${owner.id}` as const;
    const condition: ChainCondition = {
      op: 'knowledge', actor: { participant: 0 }, topic: 'haus', minConfidence: 0.5,
    };
    const run: ChainRun = {
      id: 1, chainId: 'KNOWLEDGE_PROBE', chainVersion: 1, nodeId: 'START',
      eventInstanceId: null, sourceEventId: null, status: 'RUNNING', participants: [ownerRef],
      startedTick: 0, updatedTick: 0, dueTick: 0, steps: 1, visits: { START: 1 },
      pendingEdgeId: null, lastChoiceId: null, lastOutcomeId: null, reason: null,
    };
    expect(evaluateChainCondition(condition, chainContext(world, ledger, run, INFLUENCE_CONFIG)).matched).toBe(false);
    recordFirstHand(world, { actor: ownerRef, factId: 1, sentiment: 0.8, tick: 0 });
    expect(evaluateChainCondition(condition, chainContext(world, ledger, run, INFLUENCE_CONFIG)).matched).toBe(true);
    const foreign: ChainRun = { ...run, participants: [`visitor:${stranger.id}`] };
    expect(evaluateChainCondition(condition, chainContext(world, ledger, foreign, INFLUENCE_CONFIG)).matched).toBe(false);
  });
});
