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
import { CITY_ENERGY_PER_DAY, cityOf, restInCity, travel } from '../city';
import { encounterDialog, meetNpc, takeEncounterAction } from '../city-encounter';
import { TICKS_PER_DAY } from '../demand';
import { HAUSKONTO, PORTEMONNAIE, UTILITIES } from '../money';
import { relationshipBetween } from '../narrative/relationships';
import { processNarrativeRuntime } from '../narrative/runtime';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import { replaySave, toSavedGame } from '../../../store/save';

function start(): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.tick = 0;
  world.day = 1;
  return {
    world,
    ledger: new Ledger({ [HAUSKONTO]: fromVC(500), [PORTEMONNAIE]: fromVC(20) }),
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

  it('erhaelt den Ruhetag und seine Folge ohne Tick zwischen Save und Load', () => {
    const { world, ledger, prng } = start();
    // Nicht null: nur so belegt der Vergleich, dass die Chain-Frist
    // (`startedTick` + `maxDurationTicks`) den Save ueberlebt.
    world.tick = 5;
    travel(world, 'KIEZ');
    const met = meetNpc(world, 'KIEZ');
    const npcRef = `visitor:${met.visitor.id}` as `visitor:${number}`;
    const walletBefore = ledger.getBalance(PORTEMONNAIE);
    const result = takeEncounterAction(world, ledger, met.event.id, 'GEBEN');
    expect(result.walletAfter).toBe(walletBefore - fromVC(3));
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(result.trust).toBe(2);
    processNarrativeRuntime(world, ledger);

    const runBefore = world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')!;
    expect(runBefore.status).toBe('WAITING');
    expect(runBefore.dueTick).toBe(world.tick + 24);

    // Save vor dem Ruhetag; Load ohne Tick dazwischen.
    const savedBefore = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(savedBefore)!;
    expect(loaded).not.toBeNull();
    expect(loaded.world.day).toBe(world.day);
    expect(loaded.world.tick).toBe(world.tick);
    expect(loaded.ledger.entries).toEqual(ledger.entries);
    expect(loaded.ledger.entryCount).toBe(ledger.entryCount);
    expect(loaded.world.city).toEqual(world.city);
    expect(relationshipBetween(loaded.world, npcRef, 'player'))
      .toEqual(relationshipBetween(world, npcRef, 'player'));
    expect(loaded.world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC'))
      .toEqual(runBefore);
    expect(loaded.prngState).toBe(prng.getState());

    // Der Ruhetag laeuft nach dem Load ueber den echten Tagesabschluss.
    const loadedPrng = new Prng(loaded.prngState);
    const rentBefore = rentBookings(loaded.ledger);
    restInCity(loaded.world, loaded.ledger, loadedPrng);
    expect(loaded.world.day).toBe(2);
    expect(loaded.world.tick).toBe(TICKS_PER_DAY);
    expect(loaded.world.city?.energy).toBe(CITY_ENERGY_PER_DAY);
    expect(rentBookings(loaded.ledger)).toBe(rentBefore + 1);

    const echo = loaded.world.narrative.events.find((entry) => entry.eventId === 'CITY_ENCOUNTER_ECHO_WARM')!;
    // Die Folge traegt nach dem Load noch denselben NPC wie die Begegnung.
    expect(echo.participants).toContain(npcRef);
    expect(echo.startedTick).toBe(TICKS_PER_DAY);
    expect(loaded.world.narrative.events.filter((entry) => entry.eventId.startsWith('CITY_ENCOUNTER_ECHO'))).toHaveLength(1);
    const runAfter = loaded.world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')!;
    expect(runAfter.status).toBe('RUNNING');
    expect(runAfter.eventInstanceId).toBe(echo.id);
    expect(runAfter.startedTick).toBe(runBefore.startedTick);
    expect(runAfter.reason).toBeNull();
    expect(encounterDialog(loaded.world, loaded.ledger, echo.id).text).toContain('winkt dich heran');

    // Save nach dem Tagesabschluss; Load ohne Tick darf den Tag nicht erneut abrechnen.
    const savedAfter = JSON.parse(JSON.stringify(toSavedGame(loaded.world, loaded.ledger, loadedPrng.getState())));
    const reloaded = replaySave(savedAfter)!;
    expect(reloaded).not.toBeNull();
    expect(reloaded.world.day).toBe(2);
    expect(reloaded.world.tick).toBe(TICKS_PER_DAY);
    expect(reloaded.ledger.entries).toEqual(loaded.ledger.entries);
    expect(reloaded.ledger.entryCount).toBe(loaded.ledger.entryCount);
    expect(rentBookings(reloaded.ledger)).toBe(rentBefore + 1);
    expect(reloaded.world.city?.energy).toBe(CITY_ENERGY_PER_DAY);
    expect(relationshipBetween(reloaded.world, npcRef, 'player')?.trust).toBe(2);
    expect(reloaded.world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC'))
      .toEqual(runAfter);
    expect(reloaded.world.narrative.events.find((entry) => entry.id === echo.id)).toEqual(echo);
    expect(reloaded.prngState).toBe(loadedPrng.getState());

    // Ein normaler Tick am selben Tag darf keine zweite Miete buchen.
    tickWorld(reloaded.world, reloaded.ledger, new Prng(reloaded.prngState));
    expect(reloaded.world.day).toBe(2);
    expect(rentBookings(reloaded.ledger)).toBe(rentBefore + 1);
    expect(reloaded.world.narrative.events.filter((entry) => entry.eventId.startsWith('CITY_ENCOUNTER_ECHO'))).toHaveLength(1);
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
