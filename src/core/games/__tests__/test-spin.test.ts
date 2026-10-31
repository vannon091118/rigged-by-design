/** @test-target: src/core/sim/actions.ts | @error-code: ERR-1003 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { testSpin } from '../../sim/actions';
import { createWorld } from '../../sim/templates';
import { createSlotMemory, recordSlotSpin } from '../slot-transparency';
import { randomSeed } from '../../../test/random-seed';

describe('Kostenloser Testspin', () => {
  it('lässt Maschinengedächtnis und Welt-Zufall unangetastet', () => {
    const world = createWorld('SMALL');
    const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
    slot.slotMemory = createSlotMemory();
    recordSlotSpin(slot.slotMemory, ['BOOK', 'A', 'K'], 0);
    const before = structuredClone(slot.slotMemory);
    const seed = randomSeed();
    const prng = new Prng(seed);

    expect(testSpin(slot, prng, world).game).toBe('SLOT');
    expect(testSpin(slot, prng, world).game).toBe('SLOT');

    expect(slot.slotMemory).toEqual(before);
    // Kein Welt-Zufall verbraucht: derselbe Seed liefert dieselbe Folge.
    const control = new Prng(seed);
    expect([prng.nextInt(0, 999), prng.nextInt(0, 999)])
      .toEqual([control.nextInt(0, 999), control.nextInt(0, 999)]);
  });
});
