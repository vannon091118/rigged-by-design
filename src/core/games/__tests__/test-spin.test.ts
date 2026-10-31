/** @test-target: src/core/sim/actions.ts | @error-code: ERR-1003 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { testSpin } from '../../sim/actions';
import { createWorld } from '../../sim/templates';
import type { Furniture } from '../../sim/types';
import { createSlotMemory, recordSlotSpin } from '../slot-transparency';
import { randomSeed } from '../../../test/random-seed';

/** Ein zweites Geraet desselben Typs, damit die Vorschaupfade einzeln laufen. */
function cloneAs(world: ReturnType<typeof createWorld>, gameId: Furniture['gameId'], id: number): Furniture {
  const base = world.furniture.find((item) => item.gameId === 'SLOT')!;
  const copy: Furniture = { ...base, id, gameId, mods: [] };
  world.furniture.push(copy);
  return copy;
}

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

  it('zählt beim Plinko-Testwurf weder Drops noch Sucht und zeigt dieselbe Bahn', () => {
    const world = createWorld('SMALL');
    const plinko = cloneAs(world, 'PLINKO', 9_101);
    const seed = randomSeed();
    const prng = new Prng(seed);
    const dropsBefore = world.totalPlinkoDrops;
    const addictionBefore = world.addictionScore;
    const shownBefore = structuredClone(world.lastPlinko);

    const first = testSpin(plinko, prng, world);
    const second = testSpin(plinko, prng, world);

    expect(first.game).toBe('PLINKO');
    expect(world.totalPlinkoDrops).toBe(dropsBefore);
    expect(world.addictionScore).toBe(addictionBefore);
    expect(world.lastPlinko).toEqual(shownBefore);
    // Tick und Geraet fixieren den Seed: zwei Vorschaen sind identisch.
    expect(second.label).toBe(first.label);
    expect(second.multiplierBps).toBe(first.multiplierBps);
    // Weder der Wurf noch die Anzeige durften Zufall aus der Welt ziehen.
    const control = new Prng(seed);
    expect(prng.nextInt(0, 999)).toBe(control.nextInt(0, 999));
  });

  it('drehen auch Tische ihr eigenes Los statt des Weltloses', () => {
    const world = createWorld('SMALL');
    const table = cloneAs(world, 'DICE', 9_102);
    const seed = randomSeed();
    const prng = new Prng(seed);

    expect(testSpin(table, prng, world).game).toBe('DICE');

    const control = new Prng(seed);
    expect(prng.nextInt(0, 999)).toBe(control.nextInt(0, 999));
  });
});
