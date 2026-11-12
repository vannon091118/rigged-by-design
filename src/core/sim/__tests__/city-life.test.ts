/**
 * @test-target: src/core/sim/city-life.ts
 * @error-code: ERR-2001
 *
 * Die benannten Stadt-NPCs muessen im echten `tickWorld` leben: Standort und
 * Intent folgen der Tagesroutine, Hunger/Durst/Muedigkeit veraendern sich und
 * ein dringendes Beduerfnis ueberstimmt den Plan. Der Save-Roundtrip beweist,
 * dass dieser Zustand kein UI-Cache ist.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_NPCS, ensureCityVisitor } from '../city-npcs';
import {
  cityLifeView,
  ensureCityLife,
  tickCityLife,
} from '../city-life';
import type { CityLifeState } from '../city-life-types';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';

function start(): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const rita = CITY_NPCS.find((entry) => entry.id === 'rita')!;
  ensureCityVisitor(world, rita);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
}

function resident(life: CityLifeState, id: string) {
  return life.residents.find((entry) => entry.npcId === id)!;
}

describe('Stadtleben (Ereignisketten)', () => {
  it('laesst Rita, Boris und Mira ueber einen vollen Tag Routine und Beduerfnisse wechseln', () => {
    const { world, ledger, prng } = start();
    const initial = ensureCityLife(world);
    const before = resident(initial, 'rita');

    const samples = new Map<number, CityLifeState>();
    for (let i = 0; i < 600; i += 1) {
      tickWorld(world, ledger, prng);
      if (world.tick === 225 || world.tick === 475 || world.tick === 575 || world.tick === 600) {
        samples.set(world.tick, world.cityLife);
      }
    }

    const work = resident(samples.get(225)!, 'rita');
    expect(work.intent).toBe('WORK');
    expect(work.location).toBe('KIEZ');
    expect(work.needs.hunger).not.toBe(before.needs.hunger);

    const pub = resident(samples.get(475)!, 'rita');
    expect(pub.intent).toBe('PUB');
    expect(pub.location).toBe('KIEZ');

    const sleep = resident(samples.get(575)!, 'rita');
    expect(sleep.intent).toBe('SLEEP');
    expect(sleep.location).toBe('HOME');

    const nextDay = resident(samples.get(600)!, 'rita');
    expect(nextDay.intent).toBe('SLEEP');
    expect(nextDay.location).toBe('HOME');
    expect(nextDay.lastDay).toBe(2);

    for (const sample of samples.values()) {
      for (const person of sample.residents) {
        for (const stat of [person.needs.hunger, person.needs.thirst, person.needs.fatigue, person.needs.social, person.needs.mood]) {
          expect(stat).toBeGreaterThanOrEqual(0);
          expect(stat).toBeLessThanOrEqual(100);
        }
      }
    }

    const view = cityLifeView(world);
    expect(view).toHaveLength(3);
    expect(view.find((entry) => entry.npcId === 'rita')?.traits.length).toBeGreaterThan(0);
    expect(view.find((entry) => entry.npcId === 'rita')?.locationLabel).toBe('Wohnung');
  });

  it('ueberstimmt den Tagesplan bei dringendem Durst und bewahrt den Zustand ueber Save/Load', () => {
    const { world, ledger, prng } = start();
    world.tick = 225;
    world.day = 1;
    const life = ensureCityLife(world);
    world.cityLife = {
      residents: life.residents.map((person) => person.npcId === 'rita'
        ? { ...person, lastHour: 8, lastDay: 1, needs: { ...person.needs, hunger: 20, thirst: 95, fatigue: 10, social: 30 } }
        : person),
    };
    tickCityLife(world);
    expect(resident(world.cityLife, 'rita').intent).toBe('PUB');
    expect(resident(world.cityLife, 'rita').location).toBe('KIEZ');

    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    const after = resident(loaded.world.cityLife, 'rita');
    expect(after.intent).toBe('PUB');
    expect(after.needs.thirst).toBe(75);
    expect(after.lastHour).toBe(9);
    expect(loaded.world.day).toBe(1);
  });
});
