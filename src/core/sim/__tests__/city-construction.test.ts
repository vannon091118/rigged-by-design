/**
 * @test-target: src/core/sim/city-construction.ts
 * @error-code: ERR-2001
 *
 * Ein Neubau ist zuerst ein Rohbau: versiegelt, ohne Tuerkante, ohne belegbare
 * Stellen. Der Uebergang am Folgetag oeffnet ihn genau einmal, schreibt ein
 * Journal-Ereignis und hinterlaesst eine Tuer, die den Laden oeffnet und das
 * Wohnhaus privat laesst (#524).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld, ensureStarter } from '../templates';
import { createCityScene } from '../city-scene';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { advanceCityGrowth, cityBuildings } from '../city-growth';
import {
  completeCityConstruction, grownDoorBuilding, grownDoorEffect, grownDoorId, isShell,
} from '../city-construction';
import { cityDoorEffect } from '../city-doors';
import { replaySave, toSavedGame } from '../../../store/save';

function start(residents = 60) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
}

describe('Rohbau und Fertigstellung', () => {
  it('baut einen versiegelten Rohbau ohne Tuer und ohne Stellen', () => {
    const { world, ledger } = start();
    const report = advanceCityGrowth(world, ledger)!;
    expect(isShell(report.building)).toBe(true);
    expect(report.building.locked).toBe(true);
    const doorIds = world.cityScene!.layout.edges
      .filter((edge) => edge.kind === 'DOOR')
      .map((edge) => edge.id);
    expect(doorIds).not.toContain(grownDoorId(report.building.id));
    expect(cityDoorEffect(grownDoorId(report.building.id))).toBeNull();
  });

  it('stellt den Rohbau am Folgetag fertig: Tuer, offen, ein Journal-Ereignis', () => {
    const { world, ledger } = start();
    const report = advanceCityGrowth(world, ledger)!;
    const before = world.journal.length;
    expect(completeCityConstruction(world)).toEqual([]);

    world.day += 1;
    const completed = completeCityConstruction(world);
    expect(completed.map((building) => building.id)).toEqual([report.building.id]);

    const built = cityBuildings(world).find((building) => building.id === report.building.id)!;
    expect(built.construction).toBe('OPEN');
    expect(built.locked).toBe(false);
    expect(grownDoorBuilding(grownDoorId(built.id), cityBuildings(world))?.id).toBe(built.id);
    const door = world.cityScene!.layout.edges.find((edge) => edge.id === grownDoorId(built.id));
    expect(door).toMatchObject({ kind: 'DOOR' });

    const added = world.journal.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]!.subject).toBe(`Bau fertig: ${built.name}`);
    expect(added[0]!.refs?.buildingId).toBe(built.id);
  });

  it('schliesst genau einmal: ein zweiter Lauf am selben Tag ist ein No-Op', () => {
    const { world, ledger } = start();
    const report = advanceCityGrowth(world, ledger)!;
    world.day += 1;
    completeCityConstruction(world);
    const doors = world.cityScene!.layout.edges.filter((edge) => edge.id === grownDoorId(report.building.id));
    expect(doors).toHaveLength(1);

    expect(completeCityConstruction(world)).toEqual([]);
    expect(world.journal.filter((event) => event.subject.startsWith('Bau fertig: '))).toHaveLength(1);
    expect(world.cityScene!.layout.edges.filter((edge) => edge.id === grownDoorId(report.building.id)))
      .toHaveLength(1);
  });

  it('laesst den fertigen Laden in die Marktgasse und das Wohnhaus privat', () => {
    const { world, ledger } = start();
    const report = advanceCityGrowth(world, ledger)!;
    world.day += 1;
    const [shop] = completeCityConstruction(world);
    expect(grownDoorEffect(shop!)).toEqual({ kind: 'CITY_LOCATION', location: 'MARKT' });

    const home = { ...shop!, id: 'bld_grown_home', kind: 'RESIDENCE' as const };
    expect(grownDoorEffect(home)).toBeNull();
    expect(grownDoorEffect({ ...home, construction: 'SHELL' })).toBeNull();
    expect(report.building.kind).toBe('SHOP');
  });

  it('erhaelt den Bauzustand ueber Save und Load', () => {
    const { world, ledger, prng } = start();
    const report = advanceCityGrowth(world, ledger)!;
    world.day += 1;
    completeCityConstruction(world);

    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!.world;
    const built = cityBuildings(loaded).find((building) => building.id === report.building.id)!;
    expect(built.construction).toBe('OPEN');
    expect(built.builtDay).toBe(report.building.builtDay);
    expect(loaded.cityScene!.layout.edges.some((edge) => edge.id === grownDoorId(built.id))).toBe(true);
  });
});
