/** @test-target: src/core/sim/narrative/facts.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';
import { drainFacts, emitFact, recentFacts } from '../narrative/facts';
import { processFacts } from '../narrative/memory';
import { NARRATIVE_LIMITS } from '../narrative/types';
import { normalizeNarrativeState } from '../narrative/state';

const setup = () => {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Test Gast', persona: 'STREET', tick: 0 });
  return { world, visitor };
};

describe('Narrative Facts', () => {
  it('vergibt stabile, monotone IDs und stempelt Tick und Tag aus der Welt', () => {
    const { world, visitor } = setup();
    world.tick = 7;
    world.day = 2;
    const first = emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    const second = emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 3 });
    expect([first.id, second.id]).toEqual([1, 2]);
    expect(first.tick).toBe(7);
    expect(second.day).toBe(2);
    expect(world.narrative.factSeq).toBe(3);
  });

  it('verarbeitet jede Fact-ID genau einmal, auch nach erneutem Drain', () => {
    const { world, visitor } = setup();
    emitFact(world, { kind: 'VISIT_ENDED', visitorId: visitor.id, guestId: 1, score: 80, valence: 'GOOD' });
    const fresh = drainFacts(world);
    expect(fresh).toHaveLength(1);
    expect(drainFacts(world)).toHaveLength(0);
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    const next = drainFacts(world);
    expect(next.map((fact) => fact.id)).toEqual([2]);
  });

  it('begrenzt die Queue und zaehlt die verworfenen Facts', () => {
    const { world, visitor } = setup();
    for (let index = 0; index < NARRATIVE_LIMITS.pending + 12; index += 1) {
      emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: index + 2 });
    }
    expect(world.narrative.pending).toHaveLength(NARRATIVE_LIMITS.pending);
    expect(world.narrative.dropped).toBe(12);
    expect(world.narrative.pending[0]!.id).toBe(13);
  });

  it('uebersteht einen JSON-Roundtrip ohne Verlust', () => {
    const { world, visitor } = setup();
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    emitFact(world, { kind: 'VISIT_ENDED', visitorId: visitor.id, guestId: 4, score: 20, valence: 'BAD' });
    const restored = normalizeNarrativeState(JSON.parse(JSON.stringify(world.narrative)));
    expect(restored).toEqual(world.narrative);
  });

  it('bricht bei unbekannter Besucherreferenz nicht und behaelt den Fact in der Historie', () => {
    const { world } = setup();
    emitFact(world, { kind: 'VISIT_ENDED', visitorId: 999, guestId: 5, score: 90, valence: 'GOOD' });
    expect(processFacts(world)).toBe(0);
    expect(recentFacts(world, 'VISIT_ENDED')).toHaveLength(1);
    expect(world.visitors.every((entry) => (entry.memories ?? []).length === 0)).toBe(true);
  });

  it('zaehlt Rueckkehrer und neue Gaeste als Flags, nicht als Journal', () => {
    const { world, visitor } = setup();
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    emitFact(world, { kind: 'VISITOR_FIRST_SEEN', visitorId: visitor.id, persona: 'STREET' });
    processFacts(world);
    expect(world.narrative.flags.rueckkehrer).toBe(1);
    expect(world.narrative.flags.neue_gaeste).toBe(1);
    expect(world.journal).toHaveLength(0);
  });
});
