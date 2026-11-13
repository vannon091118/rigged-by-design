/**
 * @test-target: src/render/city-plan.ts
 * @error-code: ERR-2001
 *
 * Jeder Gebäudetyp, den das Wachstum erzeugen darf, muss im Renderplan eine
 * Rolle haben. Der dritte Neubau ist ein HOME-Grundstück (RESIDENCE) und hat
 * den Produktionspfad zuvor mit einer Exception abgebrochen (#520).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createCityScene } from '../../core/sim/city-scene';
import { advanceCityGrowth } from '../../core/sim/city-growth';
import { ensureCityLife, ensureCityPopulation } from '../../core/sim/city-life-state';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { cityExteriorView } from '../../store/city-exterior-view';
import { cityRenderPlan } from '../city-plan';

describe('Renderplan nach Stadtwachstum', () => {
  it('baut drei Neubauten und plant sie ohne Render-Exception', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    world.cityScene = createCityScene();
    ensureCityLife(world);
    ensureCityPopulation(world, 60);
    const ledger = new Ledger({});
    world.day = 1;

    const kinds: string[] = [];
    for (let day = 1; day <= 3; day += 1) {
      world.day = day;
      const report = advanceCityGrowth(world, ledger);
      expect(report).not.toBeNull();
      kinds.push(report!.building.kind);
    }
    expect(kinds).toEqual(['SHOP', 'SHOP', 'RESIDENCE']);

    const plan = cityRenderPlan(cityExteriorView(world.cityScene!));
    expect(plan).not.toBeNull();
    const roles = plan!.buildings.map((building) => building.role);
    expect(roles).toContain('RESIDENCE');
    expect(roles.filter((role) => role === 'APARTMENT').length).toBeGreaterThan(0);
    expect(plan!.buildings.every((building) => building.asset.length > 0)).toBe(true);
  });
});
