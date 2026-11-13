/**
 * @test-target: src/core/sim/city-employment.ts
 * @error-code: ERR-2001
 *
 * Eine Stelle gehoert einer Figur: Der Arbeitsmarkt zaehlt Zuordnungen, nicht
 * die Differenz aus Bewohnern und Kapazitaet. Nur Zugeordnete arbeiten (#519).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld, ensureStarter } from '../templates';
import { createCityScene } from '../city-scene';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { cityBuildings, advanceCityGrowth } from '../city-growth';
import { assignEmployment, cityJobMarket } from '../city-employment';
import { tickCityLife } from '../city-life';
import { createIdleDayPlan, nextIntentForHour } from '../npc-schedule';
import { TICKS_PER_HOUR } from '../clock';
import { replaySave, toSavedGame } from '../../../store/save';

function start(residents = 60) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
}

const candidates = (world: ReturnType<typeof createWorld>) =>
  world.cityLife!.residents.map((resident) => ({ npcId: resident.npcId }));

describe('Beschaeftigung als Zuordnung', () => {
  it('vergibt nur so viele Stellen, wie Gebaeude tragen', () => {
    const { world } = start(60);
    const assigned = assignEmployment(candidates(world), cityBuildings(world));
    expect(assigned.size).toBe(19);
    const market = cityJobMarket(cityBuildings(world), candidates(world));
    expect(market).toMatchObject({ residents: 60, jobs: 19, employed: 19, openSlots: 0, jobless: 41 });
  });

  it('bleibt bei gleicher Eingabe identisch', () => {
    const { world } = start(60);
    const first = [...assignEmployment(candidates(world), cityBuildings(world))];
    const second = [...assignEmployment(candidates(world), cityBuildings(world))];
    expect(second).toEqual(first);
  });

  it('vergibt neue Stellen eines Neubaus an konkrete Bewohner', () => {
    const { world, ledger } = start(60);
    const before = assignEmployment(candidates(world), cityBuildings(world));
    const report = advanceCityGrowth(world, ledger)!;
    expect(report.building.kind).toBe('SHOP');
    const after = assignEmployment(candidates(world), cityBuildings(world));
    expect(after.size).toBe(before.size + 5);
    expect([...after.values()].filter((id) => id === report.building.id)).toHaveLength(5);
    expect(cityJobMarket(cityBuildings(world), candidates(world)).jobless).toBe(41 - 5);
  });

  it('gibt Arbeitslosen keinen WORK-Intent im Tagesplan', () => {
    const plan = createIdleDayPlan('npc_test', 'bld_player_home');
    for (let hour = 0; hour < 24; hour += 1) {
      expect(nextIntentForHour(plan, hour)?.intent).not.toBe('WORK');
    }
  });

  it('laesst hoechstens die Zugeteilten zur Arbeit gehen', () => {
    const { world } = start(60);
    world.tick = 9 * TICKS_PER_HOUR;
    world.day = 1;
    tickCityLife(world);
    const working = world.cityLife!.residents.filter((resident) => resident.intent === 'WORK').length;
    expect(working).toBeLessThanOrEqual(19);
  });

  it('rekonstruiert dieselbe Zuordnung nach Save/Load', () => {
    const { world, ledger, prng } = start(60);
    advanceCityGrowth(world, ledger);
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!.world;
    expect([...assignEmployment(candidates(loaded), cityBuildings(loaded))])
      .toEqual([...assignEmployment(candidates(world), cityBuildings(world))]);
  });
});
