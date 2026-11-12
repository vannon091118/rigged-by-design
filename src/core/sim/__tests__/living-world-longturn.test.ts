/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Ereignisketten-Evidenz: Ein langer Turn verbindet Umgebung, Erfahrung und
 * alle vorhandenen Stats. Geprueft werden die Stadtroutine im echten Tick,
 * eine aufgeloeste Begegnung mit Folgeereignis, Gastbeduerfnisse und der
 * Einfluss von Umgebung (Dreck), dazu jede Spielerstufe und das Skill-Training.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { talkChance } from '../charisma-talk';
import { CITY_NPCS, ensureCityVisitor } from '../city-npcs';
import { cityOf, travel } from '../city';
import {
  cityLifeView,
  ensureCityLife,
} from '../city-life';
import { meetNpc, takeEncounterAction } from '../city-encounter';
import { cleaningReach, maintenanceGain } from '../floor-work';
import { PORTEMONNAIE } from '../money';
import { processNarrativeRuntime } from '../narrative/runtime';
import { grantGlobalXp, luckInjuryFactor, newPlayerRpg, playerHp, playerMaxHp, playerStepsPerTick, recoverPlayer } from '../player-rpg';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { decay } from '../upkeep';
import { tickWorld } from '../tick';

describe('Living World Long Turn — Ereignisketten und alle Stats', () => {
  it('verbindet Stadtleben, Begegnung, Umgebung, Erfahrung und Spielerstufen', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    world.tick = 0;
    const ledger = new Ledger({ [PORTEMONNAIE]: fromVC(20) });
    const prng = new Prng(randomSeed());
    travel(world, 'KIEZ');

    const rita = CITY_NPCS.find((entry) => entry.id === 'rita')!;
    ensureCityVisitor(world, rita);
    const met = meetNpc(world, 'KIEZ');
    const traitsBefore = world.visitors.find((visitor) => visitor.name === rita.name)?.traits?.map((trait) => `${trait.id}:${trait.intensity}:${trait.progress}`) ?? [];
    const action = takeEncounterAction(world, ledger, met.event.id, 'GEBEN');
    expect(action.trust).toBe(2);
    const traitsAfter = world.visitors.find((visitor) => visitor.name === rita.name)?.traits?.map((trait) => `${trait.id}:${trait.intensity}:${trait.progress}`) ?? [];
    expect(traitsAfter).not.toEqual(traitsBefore);

    // Erfahrung startet die naechste Stufe der Ereigniskette, nicht ein UI-Klick.
    processNarrativeRuntime(world, ledger);
    const run = world.narrative.chains.runs.find((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')!;
    expect(run.status).toBe('WAITING');
    expect(run.dueTick).toBe(world.tick + 24);

    for (let i = 0; i < 30; i += 1) tickWorld(world, ledger, prng);
    expect(world.narrative.events.some((event) => event.eventId === 'CITY_ENCOUNTER_ECHO_WARM')).toBe(true);

    // Umgebung wirkt auf den Gast: derselbe Gast verliert auf Dreck Laune,
    // auf sauberem Boden gewinnt er sie zurueck.
    const guest = spawnGuest(world, prng, ledger)!;
    expect(guest).not.toBeNull();
    guest.position = { x: 0, y: 0 };
    guest.mood = 50;
    world.dirty.add(0);
    decay(world);
    const moodOnDirt = guest.mood;
    world.dirty.delete(0);
    guest.mood = 50;
    decay(world);
    expect(moodOnDirt).toBeLessThan(50);
    expect(guest.mood).toBeGreaterThan(50);

    // Jede Spielerstufe hat einen Leser im echten Spiel.
    const rpg = world.player.rpg;
    const speedBefore = playerStepsPerTick(rpg);
    rpg.speedLevel = 3;
    expect(playerStepsPerTick(rpg)).toBeGreaterThan(speedBefore);
    const charismaBefore = talkChance(world, guest.id);
    rpg.charismaLevel = 5;
    expect(talkChance(world, guest.id)).toBeGreaterThan(charismaBefore);
    const hpBefore = playerMaxHp(rpg);
    rpg.brawlLevel = 5;
    expect(playerMaxHp(rpg)).toBeGreaterThan(hpBefore);
    rpg.perceptionLevel = 4;
    expect(cleaningReach(world)).toBe(2);
    rpg.techniqueLevel = 5;
    expect(maintenanceGain(world)).toBe(30);
    rpg.enduranceLevel = 5;
    rpg.hp = playerMaxHp(rpg) - 1;
    recoverPlayer(rpg, 3);
    expect(playerHp(rpg)).toBe(playerMaxHp(rpg));
    rpg.luckLevel = 10;
    expect(luckInjuryFactor(rpg)).toBe(0.5);

    // Faehigkeiten wachsen aus Erfahrung: dieselbe XP-Quelle trainiert drei Attribute.
    const trained = newPlayerRpg();
    grantGlobalXp(trained, 'JOB_CLEANER', 400);
    expect(trained.speedLevel).toBe(1);
    expect(trained.perceptionLevel).toBe(1);
    expect(trained.enduranceLevel).toBe(1);

    // Zwei weitere Tage Stadtleben: alle Bewohner tragen veraenderte Beduerfnisse.
    const beforeLongRun = ensureCityLife(world);
    let nonSleepSeen = false;
    while (world.tick < 1230) {
      tickWorld(world, ledger, prng);
      if (world.cityLife.residents.some((person) => person.intent !== 'SLEEP')) nonSleepSeen = true;
    }
    const afterLongRun = ensureCityLife(world);
    expect(world.day).toBeGreaterThanOrEqual(3);
    expect(cityLifeView(world)).toHaveLength(3);
    for (const person of afterLongRun.residents) {
      const start = beforeLongRun.residents.find((entry) => entry.npcId === person.npcId)!;
      expect(person.needs).not.toEqual(start.needs);
      expect(person.lastDay).toBeGreaterThan(start.lastDay);
    }
    expect(nonSleepSeen).toBe(true);

    // Der gesamte lange Turn ueberlebt einen Save/Load-Roundtrip.
    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState()))))!;
    expect(loaded.world.cityLife.residents).toHaveLength(3);
    expect(loaded.world.narrative.chains.runs.some((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')).toBe(true);
    expect(loaded.world.city?.location).toBe('KIEZ');
    expect(cityOf(loaded.world).energy).toBeGreaterThan(0);
  });
});
