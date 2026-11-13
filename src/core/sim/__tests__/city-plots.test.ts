/**
 * @test-target: src/core/sim/city-plots.ts
 * @error-code: ERR-2001
 *
 * Ein Grundstück ist ein fester Platz im Kartenlayout. Jedes Gebäude steht auf
 * genau einem Platz, kein Platz trägt zwei Gebäude, kein Platz liegt auf einer
 * Fahrbahn — und weil der Register statisch ist, braucht kein Save ein neues
 * Feld.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { createWorld, ensureStarter } from '../templates';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_PRESET_BUILDINGS } from '../building';
import {
  CITY_PLOTS, buildingOnPlot, builtPlots, plotAt, plotAtRect, plotForBuilding,
  plotRegisterIssues,
} from '../city-plots';

describe('Grundstücksregister', () => {
  it('gibt jedem kuratierten Gebäude genau einen Platz mit seiner Grundfläche', () => {
    for (const building of CITY_PRESET_BUILDINGS) {
      const matches = CITY_PLOTS.filter((plot) => plot.rect.x === building.footprint.x
        && plot.rect.y === building.footprint.y
        && plot.rect.w === building.footprint.w
        && plot.rect.h === building.footprint.h);
      expect(matches).toHaveLength(1);
      expect(plotForBuilding(building.id)?.id).toBe(matches[0]!.id);
      expect(buildingOnPlot(matches[0]!.id)?.id).toBe(building.id);
    }
    expect(builtPlots()).toHaveLength(CITY_PRESET_BUILDINGS.length);
  });

  it('hält die Plätze fest: stabile Kennungen, keine Doppelbelegung, keine Fahrbahn', () => {
    expect(CITY_PLOTS.map((plot) => plot.id)).toEqual([
      'plot_player_home', 'plot_kiez_pub', 'plot_corner_shop', 'plot_casino_grand',
      'plot_reserve_north_west', 'plot_reserve_north_gap', 'plot_reserve_north_east',
      'plot_reserve_south_west', 'plot_reserve_south_east',
    ]);
    expect(plotRegisterIssues()).toEqual([]);
    expect(CITY_PLOTS).toBe(CITY_PLOTS);
  });

  it('lässt Reservegrundstücke leer und gewidmet', () => {
    const reserves = CITY_PLOTS.filter((plot) => plot.id.startsWith('plot_reserve_'));
    expect(reserves).toHaveLength(5);
    for (const plot of reserves) {
      expect(buildingOnPlot(plot.id)).toBeNull();
      expect(['HOME', 'BUSINESS']).toContain(plot.zoning);
      expect(plotAt(plot.rect.x, plot.rect.y)?.id).toBe(plot.id);
    }
    // Zwischen den Gebäuden ist keine Reserve: Die Straße gehört niemandem.
    expect(plotAt(28, 16)).toBeNull();
    expect(plotAt(0, 0)).toBeNull();
  });

  it('erkennt zwei Gebäude auf einem Platz und ein Gebäude ohne Platz', () => {
    const twin = { ...CITY_PRESET_BUILDINGS[1]!, id: 'bld_kiez_pub_kopie' };
    const issues = plotRegisterIssues([...CITY_PRESET_BUILDINGS, twin]);
    expect(issues.some((issue) => issue.code === 'DOUBLE_OCCUPANCY')).toBe(true);

    const stray = { ...CITY_PRESET_BUILDINGS[0]!, id: 'bld_unregistriert', footprint: { x: 50, y: 40, w: 4, h: 4 } };
    const strayIssues = plotRegisterIssues([...CITY_PRESET_BUILDINGS, stray]);
    expect(strayIssues.some((issue) => issue.code === 'UNREGISTERED_BUILDING')).toBe(true);
    expect(plotAtRect(stray.footprint)).toBeNull();
  });

  it('braucht kein Feld im Save: der Register folgt aus der Karte', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const ledger = new Ledger({});
    const prng = new Prng(4242);
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    expect(saved.plots).toBeUndefined();
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(plotForBuilding('bld_kiez_pub')?.zoning).toBe('BUSINESS');
    expect(plotRegisterIssues()).toEqual([]);
  });
});
