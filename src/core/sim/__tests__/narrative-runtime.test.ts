/** @test-target: src/core/sim/narrative/runtime.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { emitFact } from '../narrative/facts';
import { actorRefOfVisitor } from '../narrative/relationships';
import { processNarrativeRuntime } from '../narrative/runtime';
import { normalizeNarrativeState } from '../narrative/state';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import { recordVisitor } from '../visitors';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Test', persona: 'STAMMGAST', tick: 0 });
  return { world, ledger, visitor };
}

describe('Narrative Runtime', () => {
  it('macht aus einem Rueckkehrer-Fact ein Event mit genau diesem Besucher', () => {
    const { world, ledger, visitor } = setup();
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });

    const result = processNarrativeRuntime(world, ledger);

    expect(result.processed).toBe(1);
    expect(result.scheduled.map((event) => event.eventId)).toEqual(['VISITOR_RETURN']);
    expect(result.scheduled[0]?.participants).toEqual([actorRefOfVisitor(visitor.id)]);
    expect(result.scheduled[0]?.status).toBe('OFFERED');
    expect(world.narrative.flags.rueckkehrer).toBe(1);
    expect(world.narrative.pending).toHaveLength(0);
  });

  it('uebersetzt einen Streit in ein Paar-Event in Trigger-Reihenfolge', () => {
    const world = createWorld('SMALL');
    const first = recordVisitor(world, { name: 'Rita Test', persona: 'STAMMGAST', tick: 0 });
    const second = recordVisitor(world, { name: 'Boris Test', persona: 'BUSINESS', tick: 0 });
    const firstRef = actorRefOfVisitor(first.id);
    const secondRef = actorRefOfVisitor(second.id);
    emitFact(world, {
      kind: 'VISITOR_CONFLICT', actorRefs: [firstRef, secondRef], initiator: firstRef, severity: 1,
    });

    const result = processNarrativeRuntime(world, new Ledger());

    expect(result.scheduled.map((event) => event.eventId)).toEqual(['VISITOR_CONFLICT']);
    expect(result.scheduled[0]?.scope).toBe('PAIR');
    expect(result.scheduled[0]?.participants).toEqual([firstRef, secondRef]);
  });

  it('laeuft am Tick-Ende, ohne dass eine Quelle selbst drainiert', () => {
    const { world, ledger, visitor } = setup();
    ensureStarter(world);
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    expect(world.narrative.pending).toHaveLength(1);

    tickWorld(world, ledger, new Prng(randomSeed()));

    expect(world.narrative.processedId).toBeGreaterThanOrEqual(1);
    expect(world.narrative.events.map((event) => event.eventId)).toContain('VISITOR_RETURN');
    expect(world.narrative.recent.some((fact) => fact.kind === 'VISITOR_RETURNED')).toBe(true);
  });

  it('verarbeitet jede Grenze genau einmal und rekursiert nicht in neue Facts', () => {
    const { world, ledger, visitor } = setup();
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });

    const first = processNarrativeRuntime(world, ledger);
    const second = processNarrativeRuntime(world, ledger);

    expect(first.processed).toBe(1);
    expect(second.processed).toBe(0);
    expect(second.scheduled).toEqual([]);
    expect(world.narrative.events).toHaveLength(1);
    expect(world.narrative.processedId).toBe(1);
  });

  it('plant hoechstens drei neue Events pro Lauf', () => {
    const world = createWorld('SMALL');
    for (let index = 0; index < 6; index += 1) {
      const visitor = recordVisitor(world, { name: `Gast ${index}`, persona: 'STREET', tick: 0 });
      emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    }

    const result = processNarrativeRuntime(world, new Ledger());

    expect(result.processed).toBe(6);
    expect(result.scheduled).toHaveLength(3);
    expect(new Set(result.scheduled.map((event) => event.eventId))).toEqual(new Set(['VISITOR_RETURN']));
    expect(processNarrativeRuntime(world, new Ledger()).scheduled).toEqual([]);
  });

  it('erzeugt nach einem Save-Roundtrip kein zweites Event', () => {
    const { world, ledger, visitor } = setup();
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    processNarrativeRuntime(world, ledger);

    const restored = createWorld('SMALL');
    restored.narrative = normalizeNarrativeState(JSON.parse(JSON.stringify(world.narrative)));
    restored.visitors = world.visitors.map((entry) => ({ ...entry, memories: [...(entry.memories ?? [])] }));
    restored.tick = world.tick;

    expect(restored.narrative.events).toEqual(world.narrative.events);
    const replay = processNarrativeRuntime(restored, ledger);
    expect(replay.processed).toBe(0);
    expect(replay.scheduled).toEqual([]);
    expect(restored.narrative.events).toEqual(world.narrative.events);
  });
});
