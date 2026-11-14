/**
 * @test-target: src/store/snapshot.ts
 * @error-code: ERR-1002
 *
 * Die Wachstumssicht ist eine Projektion: `buildView` liest dieselbe
 * `cityGrowthView` wie das Stadtfenster, nennt den letzten Bau und verändert
 * beim Lesen weder Welt noch Journal (#526).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { advanceCityGrowth, BUILD_COST } from '../../core/sim/city-growth';

import { ensureCityLife, ensureCityPopulation } from '../../core/sim/city-life-state';
import { createCityScene } from '../../core/sim/city-scene';
import { buildView } from '../snapshot';
import { createWorld, ensureStarter } from '../../core/sim/templates';

const start = (residents: number) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}) };
};

describe('Wachstum im GameView', () => {
  it('stellt Arbeitsmarkt, Kapital, freie Grundstücke und den letzten Bau bereit', () => {
    const { world, ledger } = start(60);
    world.day = 1;
    const report = advanceCityGrowth(world, ledger)!;
    const journalBefore = world.journal.length;

    const view = buildView(world, ledger, '');

    expect(view.cityGrowth.residents).toBe(60);
    expect(view.cityGrowth.jobs).toBeGreaterThan(0);
    // Der Neubau steht versiegelt: Er vergibt noch keine Stellen (#566).
    expect(view.cityGrowth.jobless).toBe(report.joblessBefore);
    expect(view.cityGrowth.capital).toBeGreaterThanOrEqual(0);
    expect(view.cityGrowth.freePlots).toBeGreaterThan(0);
    expect(view.cityGrowth.built).toBe(1);
    expect(view.cityGrowth.blockedReason).toBe('READY');
    expect(view.cityGrowth.lastBuild).toMatchObject({
      id: report.building.id,
      name: report.building.name,
      plotId: report.plotId,
      day: 1,
      cost: BUILD_COST,
    });
    // Die Sicht legt nichts an und schreibt kein zweites Ereignis.
    expect(world.cityGrowth?.built).toEqual([report.building.id]);
    expect(world.journal).toHaveLength(journalBefore);
    expect(view.journal.some((event) => event.refs?.buildingId === report.building.id)).toBe(true);
  });

  it('nennt den Grund ohne Bau und lässt den letzten Bau leer', () => {
    const { world, ledger } = start(12);

    const view = buildView(world, ledger, '');

    expect(view.cityGrowth.built).toBe(0);
    expect(view.cityGrowth.lastBuild).toBeNull();
    expect(view.cityGrowth.blockedReason).toBe('NO_JOBLESS');
    expect(view.cityGrowth.canBuild).toBe(false);
    expect(view.journal.some((event) => event.subject.startsWith('Neubau: '))).toBe(false);
  });
});
