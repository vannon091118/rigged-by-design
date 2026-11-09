/**
 * @test-target: src/core/sim/city-actions.ts
 * @error-code: ERR-2001
 *
 * Der Tagesabschluss der Stadt darf keinen zweiten Kalender fuehren:
 * `restInCity` laeuft bis zum naechsten Tageswechsel durch `tickWorld`, sodass
 * Loehne, Miete und Strafen genau einmal verarbeitet werden. Der naechste
 * normale Tageswechsel darf `world.day` danach nicht erneut hochzaehlen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { CITY_ENERGY_PER_DAY, cityOf, restInCity } from '../city';
import { TICKS_PER_DAY } from '../demand';
import { HAUSKONTO, UTILITIES } from '../money';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';

function start(): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.tick = 0;
  world.day = 1;
  return {
    world,
    ledger: new Ledger({ [HAUSKONTO]: fromVC(500) }),
    prng: new Prng(randomSeed()),
  };
}

function rentBookings(ledger: Ledger): number {
  return ledger.entries.filter((entry) => entry.to === UTILITIES && entry.reason.includes('miete')).length;
}

describe('Stadt-Tagesabschluss', () => {
  it('fuehrt den Tagesabschluss ueber den kanonischen Tickpfad aus', () => {
    const { world, ledger, prng } = start();
    world.activePenalties = [{ kind: 'UNSAFE_REPUTATION', daysLeft: 2 }];

    restInCity(world, ledger, prng);

    expect(world.tick).toBe(TICKS_PER_DAY);
    expect(world.day).toBe(2);
    expect(world.activePenalties).toEqual([{ kind: 'UNSAFE_REPUTATION', daysLeft: 1 }]);
    expect(rentBookings(ledger)).toBe(1);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY);
  });

  it('zaehlt den Tag beim naechsten Tagesraster nicht doppelt', () => {
    const { world, ledger, prng } = start();
    restInCity(world, ledger, prng);
    expect(world.tick).toBe(TICKS_PER_DAY);
    expect(world.day).toBe(2);

    tickWorld(world, ledger, prng);
    expect(world.tick).toBe(TICKS_PER_DAY + 1);
    expect(world.day).toBe(2);

    for (let step = 1; step < TICKS_PER_DAY; step += 1) tickWorld(world, ledger, prng);
    expect(world.tick).toBe(TICKS_PER_DAY * 2);
    expect(world.day).toBe(3);
    expect(rentBookings(ledger)).toBe(2);
  });
});
