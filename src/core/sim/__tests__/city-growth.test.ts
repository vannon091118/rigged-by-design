/**
 * @test-target: src/core/sim/city-growth.ts
 * @error-code: ERR-2001
 *
 * Die Stadt baut auf ein Signal, nicht auf einen Timer: Ohne Joblose passiert
 * nichts, ohne Kapital auch nicht, und mit beidem entsteht ein Gebäude auf einem
 * festen Platz — samt Wänden, neuem Slot und einer Buchung, die im Ledger steht.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld, ensureStarter } from '../templates';
import { createCityScene } from '../city-scene';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import {
  cityBuildings, cityGrowthView, jobMarket, advanceCityGrowth,
  BUILD_COST, BUILDER_ACCOUNT, BUILDER_START_CAPITAL,
} from '../city-growth';
import { CITY_PLOTS } from '../city-plots';
import { EXTERNAL, EXTERNAL_WORK } from '../money';
import { replaySave, toSavedGame } from '../../../store/save';

const start = (residents = 12) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};

describe('Bauträger und Wachstum', () => {
  it('zählt Stellen und Joblose aus Gebäuden und Bewohnern', () => {
    const { world } = start(12);
    const market = jobMarket(cityBuildings(world), world.cityLife.residents.length);
    expect(market.jobs).toBeGreaterThan(12);
    expect(market.openSlots).toBeGreaterThan(0);
    expect(market.jobless).toBe(0);
    expect(cityGrowthView(world, new Ledger({})).canBuild).toBe(false);
  });

  it('baut ohne Joblose nicht, auch bei freien Plätzen', () => {
    const { world, ledger } = start(12);
    expect(advanceCityGrowth(world, ledger)).toBeNull();
    expect(ledger.getBalance(BUILDER_ACCOUNT)).toBe(0);
  });

  it('baut mit Joblosen und Kapital auf einem festen Platz, bucht den Bau', () => {
    const { world, ledger } = start(60);
    const before = cityBuildings(world).length;
    const report = advanceCityGrowth(world, ledger);
    expect(report).not.toBeNull();
    expect(report!.plotId.startsWith('plot_reserve_')).toBe(true);
    expect(cityBuildings(world)).toHaveLength(before + 1);
    expect(report!.building.kind).toBe('SHOP');
    expect(report!.building.locked).toBe(true);
    expect(ledger.getBalance(BUILDER_ACCOUNT)).toBe(BUILDER_START_CAPITAL - BUILD_COST);
    expect(ledger.entries.some((entry) => entry.from === BUILDER_ACCOUNT && entry.to === EXTERNAL_WORK)).toBe(true);
    expect(world.cityGrowth?.built).toEqual([report!.building.id]);
    // Der Neubau gibt Arbeit: die Zahl der Joblosen sinkt um seine Stellen.
    expect(jobMarket(cityBuildings(world), world.cityLife.residents.length).jobless)
      .toBe(report!.joblessBefore - 5);
    // Er steht als Wand in der Szene, nicht nur im Register.
    const walls = world.cityScene!.layout.edges.filter((edge) => edge.kind === 'WALL').length;
    expect(walls).toBeGreaterThan(0);
  });

  it('baut höchstens ein Gebäude pro Tag und nie ohne Kapital', () => {
    const { world, ledger } = start(80);
    const first = advanceCityGrowth(world, ledger);
    expect(first).not.toBeNull();
    expect(advanceCityGrowth(world, ledger)).toBeNull();
    world.day += 1;
    world.tick += 600;
    const second = advanceCityGrowth(world, ledger);
    expect(second).not.toBeNull();
    expect(second!.building.id).not.toBe(first!.building.id);
    // Kapital verbrauchen: der Bauträger baut nicht mehr.
    ledger.transfer(BUILDER_ACCOUNT, EXTERNAL, ledger.getBalance(BUILDER_ACCOUNT), 'Test: entleeren', world.tick);
    world.day += 1;
    world.tick += 600;
    expect(advanceCityGrowth(world, ledger)).toBeNull();
  });

  it('hört auf, wenn kein freier Platz mehr da ist', () => {
    const { world, ledger } = start(400);
    const free = CITY_PLOTS.length - cityBuildings(world).length;
    let built = 0;
    for (let day = 0; day <= free + 2; day += 1) {
      // Genug Kapital, damit hier der Platz und nicht das Konto die Grenze ist.
      ledger.transfer(EXTERNAL, BUILDER_ACCOUNT, BUILD_COST, 'Test: Kapital', world.tick);
      world.day = day + 1;
      world.tick = (day + 1) * 600;
      if (advanceCityGrowth(world, ledger)) built += 1;
    }
    expect(built).toBe(free);
    expect(cityBuildings(world)).toHaveLength(CITY_PLOTS.length);
  });

  it('behält Gebäude und Wachstumsstand über Save/Load', () => {
    const { world, ledger, prng } = start(60);
    const report = advanceCityGrowth(world, ledger)!;
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    expect(loaded.world.cityGrowth?.built).toEqual([report.building.id]);
    expect(cityBuildings(loaded.world).some((building) => building.id === report.building.id)).toBe(true);
  });
});
