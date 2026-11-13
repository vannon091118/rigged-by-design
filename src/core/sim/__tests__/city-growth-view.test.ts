/**
 * @test-target: src/core/sim/city-growth-view.ts
 * @error-code: ERR-2001
 *
 * Die Sicht ist eine reine Projektion: Sie nennt Arbeitsmarkt, Kapital, freie
 * Plätze, den Stillstandsgrund und den letzten Bau, ohne Zustand anzulegen.
 * Snapshot und Stadtfenster lesen genau diese Werte (#526).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { advanceCityGrowth, BUILD_COST, BUILDER_ACCOUNT, BUILDER_START_CAPITAL, cityBuildings } from '../city-growth';
import { cityGrowthView } from '../city-growth-view';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { createCityScene } from '../city-scene';
import { CITY_PLOTS } from '../city-plots';
import { createWorld, ensureStarter } from '../templates';

const start = (residents = 12) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}) };
};

describe('Stadtwachstums-Sicht', () => {
  it('zählt Stellen und Joblose aus Gebäuden und Bewohnern', () => {
    const { world, ledger } = start(12);
    const view = cityGrowthView(world, ledger);
    expect(view.residents).toBe(12);
    expect(view.jobs).toBeGreaterThan(12);
    expect(view.jobless).toBe(0);
    expect(view.canBuild).toBe(false);
    expect(view.built).toBe(0);
    expect(view.lastBuild).toBeNull();
  });

  it('nennt NO_JOBLESS ohne Bau und zieht keine Foerderung', () => {
    const { world, ledger } = start(12);
    const view = cityGrowthView(world, ledger);
    expect(view.blockedReason).toBe('NO_JOBLESS');
    expect(view.capital).toBe(0);
    expect(view.freePlots).toBe(CITY_PLOTS.length - cityBuildings(world).length);
    expect(world.cityGrowth).toBeUndefined();
    expect(ledger.getBalance(BUILDER_ACCOUNT)).toBe(0);
  });

  it('nennt den letzten Bau, die freien Plätze und das Bauträger-Kapital', () => {
    const { world, ledger } = start(60);
    world.day = 1;
    const before = cityBuildings(world).length;
    const report = advanceCityGrowth(world, ledger)!;

    const view = cityGrowthView(world, ledger);

    expect(view.built).toBe(1);
    expect(view.freePlots).toBe(CITY_PLOTS.length - before - 1);
    expect(view.capital).toBe(BUILDER_START_CAPITAL - BUILD_COST);
    expect(view.blockedReason).toBe('READY');
    expect(view.canBuild).toBe(true);
    expect(view.lastBuild).toEqual({
      id: report.building.id,
      name: report.building.name,
      plotId: report.plotId,
      plotLabel: report.building.name.replace('Neubau ', ''),
      day: 1,
      cost: BUILD_COST,
    });
  });

  it('meldet NO_PLOTS, wenn alle Grundstücke bebaut sind', () => {
    const { world, ledger } = start(400);
    const free = CITY_PLOTS.length - cityBuildings(world).length;
    for (let day = 0; day <= free + 1; day += 1) {
      world.day = day + 1;
      world.tick = (day + 1) * 600;
      advanceCityGrowth(world, ledger);
    }

    const view = cityGrowthView(world, ledger);

    expect(view.freePlots).toBe(0);
    expect(view.built).toBe(free);
    expect(view.blockedReason).toBe('NO_PLOTS');
    expect(view.canBuild).toBe(false);
  });
});
