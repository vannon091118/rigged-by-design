/** @test-target: src/core/sim/narrative/memory.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { emitFact } from '../narrative/facts';
import { memoryEffect, processFacts, valenceOf } from '../narrative/memory';
import { NARRATIVE_LIMITS } from '../narrative/types';
import { createWorld } from '../templates';
import { pickReturningVisitor, recordVisitor, returnChance } from '../visitors';
import { spawnGuest } from '../spawn';

const withVisitor = () => {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Probe', persona: 'STAMMGAST', tick: 0 });
  return { world, visitor };
};

const endVisit = (world: ReturnType<typeof createWorld>, visitorId: number, score: number) => {
  emitFact(world, { kind: 'VISIT_ENDED', visitorId, guestId: 1, score, valence: valenceOf(score) });
  processFacts(world);
};

describe('Charaktergedaechtnis', () => {
  it('erhoeht die Rueckkehrchance nach einem guten Besuch und senkt sie nach einem schlechten', () => {
    const { world, visitor } = withVisitor();
    const neutral = returnChance(visitor);
    endVisit(world, visitor.id, 90);
    const good = returnChance(visitor);
    const negative = withVisitor();
    endVisit(negative.world, negative.visitor.id, 10);
    // Genau messbar: 25 Prozent neutral, +8 nach gutem, -12 nach schlechtem Besuch.
    expect(neutral).toBe(25);
    expect(good).toBe(33);
    expect(returnChance(negative.visitor)).toBe(13);
  });

  it('laesst die letzte Erinnerung doppelt zaehlen', () => {
    const goodThenBad = withVisitor();
    endVisit(goodThenBad.world, goodThenBad.visitor.id, 90);
    endVisit(goodThenBad.world, goodThenBad.visitor.id, 10);
    const badThenGood = withVisitor();
    endVisit(badThenGood.world, badThenGood.visitor.id, 10);
    endVisit(badThenGood.world, badThenGood.visitor.id, 90);
    // +6 - 8 = -2 gegen -4 + 12 = 8: die Reihenfolge entscheidet, weil die letzte doppelt wiegt.
    expect(memoryEffect(goodThenBad.visitor).moodBonus).toBe(-2);
    expect(memoryEffect(badThenGood.visitor).moodBonus).toBe(8);
  });

  it('begrenzt die Erinnerungen pro Besucher', () => {
    const { world, visitor } = withVisitor();
    for (let index = 0; index < NARRATIVE_LIMITS.memories + 4; index += 1) endVisit(world, visitor.id, 90);
    expect(visitor.memories).toHaveLength(NARRATIVE_LIMITS.memories);
  });

  it('gibt einem wiederkehrenden Stammgast mit guter Erinnerung mehr Laune beim Spawn', () => {
    const control = createWorld('SMALL');
    const returning = createWorld('SMALL');
    const profile = recordVisitor(returning, { name: 'Boris Falk', persona: 'BUSINESS', tick: 0 });
    endVisit(returning, profile.id, 95);
    const twin = recordVisitor(control, { name: 'Boris Falk', persona: 'BUSINESS', tick: 0 });
    let guestId = 0;
    for (let id = 1; id <= 200 && guestId === 0; id += 1) {
      if (pickReturningVisitor(returning, id)?.id === profile.id && pickReturningVisitor(control, id)?.id === twin.id) guestId = id;
    }
    expect(guestId).toBeGreaterThan(0);
    returning.nextGuestId = guestId;
    control.nextGuestId = guestId;
    const seed = randomSeed();
    const warm = spawnGuest(returning, new Prng(seed), new Ledger());
    const cold = spawnGuest(control, new Prng(seed), new Ledger());
    expect(warm).not.toBeNull();
    expect(cold).not.toBeNull();
    expect(warm!.mood - cold!.mood).toBe(memoryEffect(profile).moodBonus);
    expect(memoryEffect(profile).moodBonus).toBeGreaterThan(0);
  });
});
