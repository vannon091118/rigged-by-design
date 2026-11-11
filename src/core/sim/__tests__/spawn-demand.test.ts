/**
 * @test-target: src/core/sim/spawn.ts, src/core/sim/demand.ts
 * @error-code: ERR-2001
 *
 * Der erste Gast braucht eine Kasse und den eigenen Floor. Ohne beides darf
 * weder eine Gast-ID noch ein Zufallswert verbraucht werden.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { tickDemand } from '../demand';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import { exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  return { world: createWorld('SMALL'), ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

function withoutDesk(world: ReturnType<typeof createWorld>): void {
  world.furniture = world.furniture.filter((item) => item.kind !== 'EXCHANGE');
}

describe('Erster Gast', () => {
  it('laesst ohne Kasse weder Gast noch Zufall entstehen', () => {
    const { world, ledger, prng } = setup();
    withoutDesk(world);
    const id = world.nextGuestId;
    const state = prng.getState();
    expect(spawnGuest(world, prng, ledger)).toBeNull();
    expect(world.nextGuestId).toBe(id);
    expect(prng.getState()).toBe(state);
  });

  it('plant in der Stadt keine Ankunft, solange der eigene Floor geschlossen ist', () => {
    const { world, ledger, prng } = setup();
    world.scene = { kind: 'CITY' };
    world.nextArrivalTick = world.tick + 1;
    const id = world.nextGuestId;
    const state = prng.getState();
    const arrival = world.nextArrivalTick;
    tickDemand(world, ledger, prng);
    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(id);
    expect(prng.getState()).toBe(state);
    expect(world.nextArrivalTick).toBe(arrival);
  });

  it('plant ohne Kasse keine Ankunft und verbraucht keinen Zufall', () => {
    const { world, ledger, prng } = setup();
    withoutDesk(world);
    world.tick = 12;
    world.nextArrivalTick = 12;
    const id = world.nextGuestId;
    const state = prng.getState();
    tickDemand(world, ledger, prng);
    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(id);
    expect(prng.getState()).toBe(state);
    expect(world.nextArrivalTick).toBe(12);
  });

  it('laesst den ersten Gast erst nach dem Wechsel ins eigene Casino herein', () => {
    const { world, ledger, prng } = setup();
    world.scene = { kind: 'CITY' };
    world.nextArrivalTick = world.tick + 1;
    tickWorld(world, ledger, prng);
    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(1);

    world.scene = { kind: 'OWN' };
    tickWorld(world, ledger, prng);
    expect(world.guests.length).toBeGreaterThan(0);
    expect(world.nextArrivalTick).toBeGreaterThan(world.tick);
    expect(exchangePoint(world)).not.toBeNull();
  });
});
