/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Ereignisketten-Evidenz: Ein langer Turn verbindet Umgebung, Erfahrung und
 * alle vorhandenen Stats. Geprueft werden die Stadtroutine im echten Tick,
 * eine aufgeloeste Begegnung mit Folgeereignis, Gastbeduerfnisse und der
 * Einfluss von Umgebung (Dreck), dazu jede Spielerstufe und das Skill-Training.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { replaySave, toSavedGame } from '../../../store/save';
import { talkChance } from '../charisma-talk';
import { CITY_NPCS, ensureCityVisitor } from '../city-npcs';
import { cityOf, runCityAction, travel } from '../city';
import { TICKS_PER_DAY } from '../demand';
import { cityLifeView, ensureCityLife } from '../city-life';
import { meetNpc, takeEncounterAction } from '../city-encounter';
import { cleaningReach, maintenanceGain } from '../floor-work';
import { PORTEMONNAIE } from '../money';
import { processNarrativeRuntime } from '../narrative/runtime';
import { grantGlobalXp, luckInjuryFactor, newPlayerRpg, playerHp, playerMaxHp, playerStepsPerTick, recoverPlayer } from '../player-rpg';
import { playerCareer } from '../player-career';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { decay } from '../upkeep';
import { tickWorld } from '../tick';
import { buildLongTurnEvidence } from '../living-world-longturn-evidence';
import { citySnapshot, rpgSnapshot, routineSample, summarizeCausalChain, type RoutineSample } from '../living-world-longturn-snapshots';
import { findCausalChain } from '../city-life-sim';
import type { CityLifeDecision } from '../city-life-types';

const SEED = 424242; const DAYS = 4;
const EVIDENCE_OUT = process.env.RBD_LIVING_WORLD_EVIDENCE_OUT;
const EVIDENCE_COMMAND = 'RBD_LIVING_WORLD_EVIDENCE_OUT=docs/evidence/living-world-longturn-424242-4d.json npx pnpm exec vitest run src/core/sim/__tests__/living-world-longturn.test.ts';

describe('Living World Long Turn — Ereignisketten und alle Stats', () => {
  it('verbindet Stadtleben, Begegnung, Umgebung, Erfahrung und Spielerstufen', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    world.tick = 0;
    const ledger = new Ledger({ [PORTEMONNAIE]: fromVC(20) });
    const prng = new Prng(SEED);
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
    const arcBefore = { status: run.status, dueTick: run.dueTick };

    for (let i = 0; i < 30; i += 1) tickWorld(world, ledger, prng);
    const echoSeen = world.narrative.events.some((event) => event.eventId === 'CITY_ENCOUNTER_ECHO_WARM');
    expect(echoSeen).toBe(true);
    const arcAfter = { status: run.status, dueTick: run.dueTick };

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
    const moodOnClean = guest.mood;
    expect(moodOnDirt).toBeLessThan(50);
    expect(moodOnClean).toBeGreaterThan(50);

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
    const trainedBefore = rpgSnapshot(trained);
    grantGlobalXp(trained, 'JOB_CLEANER', 400);
    const trainedAfter = rpgSnapshot(trained);
    expect(trained.speedLevel).toBe(1);
    expect(trained.perceptionLevel).toBe(1);
    expect(trained.enduranceLevel).toBe(1);

    // Vier weitere Tage Stadtleben: alle Bewohner tragen veraenderte Beduerfnisse,
    // und auch der Spieler-Hunger läuft im echten Tick mit.
    const beforeLongRun = ensureCityLife(world);
    const cityBefore = citySnapshot(beforeLongRun);
    let nonSleepSeen = false;
    const routineSamples: RoutineSample[] = [];
    const allDecisions: CityLifeDecision[] = [];
    const seenDecisions = new Set<number>();
    let scheduledDeviations = 0;
    while (world.tick < TICKS_PER_DAY * 4) {
      tickWorld(world, ledger, prng);
      if (world.cityLife.residents.some((person) => person.intent !== 'SLEEP')) nonSleepSeen = true;
      for (const decision of world.cityLife.lastDecisions ?? []) {
        if (seenDecisions.has(decision.id)) continue;
        seenDecisions.add(decision.id);
        allDecisions.push(decision);
        routineSamples.push(routineSample(decision));
        if (decision.scheduledIntent !== decision.intent) scheduledDeviations += 1;
      }
    }
    const afterLongRun = ensureCityLife(world);
    const cityAfter = citySnapshot(afterLongRun);
    expect(world.day).toBeGreaterThanOrEqual(5);
    expect(cityLifeView(world)).toHaveLength(3);
    for (const person of afterLongRun.residents) {
      const start = beforeLongRun.residents.find((entry) => entry.npcId === person.npcId)!;
      expect(person.needs).not.toEqual(start.needs);
      expect(person.lastDay).toBeGreaterThan(start.lastDay);
    }
    expect(nonSleepSeen).toBe(true);

    // Hunger/Durst sind nach vier Tagen dringend und veraendern dieselbe
    // Stadtaktion messbar: erst 0.2 Ruf, nach Essen und Trinken 0.4 Ruf.
    expect(world.player.needs.hunger).toBeGreaterThan(80);
    expect(world.player.needs.thirst).toBeGreaterThan(80);
    const playerBeforeMeal = { ...world.player.needs };
    console.log(`[longturn] vorMahlzeit hunger=${Math.round(world.player.needs.hunger)} durst=${Math.round(world.player.needs.thirst)}`);
    const hungryReputation = world.reputation;
    const hungryVisit = runCityAction(world, 'KIEZ_ANSPRECHEN');
    const hungryGain = world.reputation - hungryReputation;
    expect(hungryGain).toBeCloseTo(0.2, 1);
    expect(hungryVisit.lastResult).toContain('Hunger und Durst drücken');

    const meal = runCityAction(world, 'KIEZ_ESSEN');
    const drink = runCityAction(world, 'KIEZ_TRINKEN');
    expect(meal.lastResult).toContain('Hunger');
    expect(drink.lastResult).toContain('Durst');
    expect(world.player.needs.hunger).toBeLessThan(50);
    expect(world.player.needs.thirst).toBeLessThan(50);
    expect(world.player.rpg.attributeXp.endurance).toBeGreaterThan(0);
    const playerAfterMeal = { ...world.player.needs };
    expect(playerAfterMeal.hunger).toBeLessThan(playerBeforeMeal.hunger);
    expect(playerAfterMeal.thirst).toBeLessThan(playerBeforeMeal.thirst);
    expect(playerCareer(world, fromVC(20), fromVC(0)).needs.condition).toBe('Satt und wach');

    const fedReputation = world.reputation;
    runCityAction(world, 'KIEZ_ANSPRECHEN');
    const fedGain = world.reputation - fedReputation;
    expect(fedGain).toBeCloseTo(0.4, 1);
    console.log(`[longturn] tag=${world.day} hunger=${Math.round(world.player.needs.hunger)} durst=${Math.round(world.player.needs.thirst)} rufHungrig=+${hungryGain.toFixed(2)} rufSatt=+${fedGain.toFixed(2)} ausdauerXp=${world.player.rpg.attributeXp.endurance ?? 0} traits=${traitsBefore.join('|')} -> ${traitsAfter.join('|')} arc=${run.status} echo=${echoSeen}`);

    // Der gesamte lange Turn ueberlebt einen Save/Load-Roundtrip.
    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState()))))!;
    expect(loaded.world.cityLife.residents).toHaveLength(3);
    expect(loaded.world.narrative.chains.runs.some((entry) => entry.chainId === 'CITY_ENCOUNTER_ARC')).toBe(true);
    expect(loaded.world.city?.location).toBe('KIEZ');
    expect(cityOf(loaded.world).energy).toBeGreaterThan(0);
    expect(loaded.world.player.needs).toEqual(world.player.needs);

    expect(cityAfter.some((person) => {
      const start = cityBefore.find((entry) => entry.npcId === person.npcId)!;
      return JSON.stringify(person.skills) !== JSON.stringify(start.skills);
    })).toBe(true);
    expect(routineSamples.length).toBeGreaterThan(100);
    expect(scheduledDeviations).toBeGreaterThan(0);
    expect(trainedAfter.speed).toBeGreaterThan(trainedBefore.speed ?? 0);
    expect(trainedAfter.perception).toBeGreaterThan(trainedBefore.perception ?? 0);
    expect(trainedAfter.endurance).toBeGreaterThan(trainedBefore.endurance ?? 0);
    const causalChain = findCausalChain(allDecisions);
    if (!causalChain) throw new Error('keine Mahlzeit-Erinnerung-Verhaltens-Kette im Lauf');
    const chainEvidence = summarizeCausalChain(causalChain);

    const evidence = buildLongTurnEvidence({
      seed: SEED, days: DAYS, ticks: world.tick, command: EVIDENCE_COMMAND,
      playerBeforeMeal, playerAfterMeal, cityBefore, cityAfter,
      traitsBefore, traitsAfter, trainedBefore, trainedAfter,
      arcBefore, arcAfter, echoSeen, actionTrust: action.trust,
      moodOnDirt, moodOnClean,
      hungryGain, fedGain, routineSamples, scheduledDeviations, causalChain: chainEvidence,
    });
    if (EVIDENCE_OUT) {
      const target = resolve(process.cwd(), EVIDENCE_OUT);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`);
    }
  });
});
