/**
 * @test-target: src/core/sim/club-night.ts
 * @error-code: ERR-2001
 *
 * Der Clubabend ist keine zweite Lounge: Oeffnungszeit, Belegung und
 * Lautstaerke stammen aus Tick, Bereichsableitung und dem einen WorldState.
 * Geprueft werden die Phasengrenzen, die Summe der Gaeste, der Deckel und der
 * echte Wartepfad eines Gastes in der Lounge.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { clubNight } from '../club-night';
import { chooseActivity } from '../guest-choice';
import { guestAccount } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import type { Guest, WorldState } from '../types';

/** Alle Sitze belegt, Bar leer, WCs verstopft: der Gast muss warten. */
function blockAllSeats(world: WorldState): void {
  for (const item of world.furniture) {
    if (item.seats > 0) item.occupants = Array.from({ length: item.seats }, (_, index) => 9000 + index);
  }
  for (const item of world.furniture) {
    if (item.gameId) item.damaged = true;
    if (item.kind === 'BAR') item.stock = 0;
    if (item.kind === 'TOILET') item.clogged = true;
  }
}

function waitingGuest(world: WorldState, ledger: Ledger): Guest {
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
  guest.bladder = 0;
  guest.thirst = 0;
  guest.need = 'play';
  guest.mood = 60;
  guest.patience = 60;
  guest.sociability = 10;
  return guest;
}

describe('Clubabend in der Lounge', () => {
  it('oeffnet nur abends und nachts und nie ohne Lounge', () => {
    const world = createWorld('SMALL');
    world.tick = 0;
    expect(clubNight(world).open).toBe(false);
    world.tick = 199;
    expect(clubNight(world).open).toBe(false);
    world.tick = 200;
    expect(clubNight(world)).toMatchObject({ open: true, phase: 'evening', volume: 4, moodGain: 3 });
    world.tick = 450;
    expect(clubNight(world)).toMatchObject({ open: true, phase: 'night' });
    world.zones = world.zones.filter((zone) => zone.kind !== 'LOUNGE');
    expect(clubNight(world)).toMatchObject({ open: false, guests: 0, volume: 0, moodGain: 0 });
  });

  it('summiert die Belegung der Lounge und liefert bei gleichem Zustand dasselbe', () => {
    const world = createWorld('SMALL');
    world.tick = 450;
    const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE')!;
    const ledger = new Ledger();
    for (let index = 0; index < 3; index += 1) {
      const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
      guest.targetFurniture = 0;
      guest.position = { x: lounge.x + index, y: lounge.y + 1 };
    }
    const state = clubNight(world);
    expect(state.guests).toBe(3);
    expect(state.volume).toBe(7);
    expect(state.moodGain).toBe(3);
    expect(clubNight(world)).toEqual(state);
  });

  it('deckelt die Lautstaerke bei zehn und nimmt dort einen Punkt Laune zurueck', () => {
    const world = createWorld('SMALL');
    world.tick = 450;
    const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE')!;
    const ledger = new Ledger();
    for (let index = 0; index < 6; index += 1) {
      const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
      guest.targetFurniture = 0;
      guest.position = { x: lounge.x + index, y: lounge.y + 1 };
    }
    expect(clubNight(world)).toMatchObject({ guests: 6, volume: 10, moodGain: 2 });
  });

  it('gibt einem wartenden Gast im Club Laune statt nur Abzug', () => {
    const run = (tick: number) => {
      const world = createWorld('SMALL');
      world.tick = tick;
      const ledger = new Ledger();
      blockAllSeats(world);
      const guest = waitingGuest(world, ledger);
      const before = guest.mood;
      chooseActivity(world, guest, ledger, new Prng(randomSeed()));
      return { state: guest.state, delta: guest.mood - before };
    };
    const night = run(450);
    expect(night.state).toBe('WAIT');
    expect(night.delta).toBeGreaterThan(0);
    const morning = run(50);
    expect(morning.state).toBe('WAIT');
    expect(morning.delta).toBeLessThan(0);
  });
});
