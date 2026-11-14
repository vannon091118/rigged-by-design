/**
 * @test-target: src/core/sim/city-households.ts
 * @error-code: ERR-2001
 *
 * Jeder Bewohner hat eine eigene, gespeicherte Wohnadresse. Die Zuordnung
 * verteilt deterministisch und kapazitaetsgebunden auf vorhandene NPC-Haeuser;
 * ohne Wohnhaus bleibt die Spielerwohnung ein ausdruecklich geteilter
 * Ausweich-Haushalt. Die Produktentscheidung "eigene Haeuser vs.
 * Wohngemeinschaften" wird hier nicht vorweggenommen.
 */
import { describe, expect, it } from 'vitest';
import { CITY_PRESET_BUILDINGS, createBuilding } from '../building';
import {
  HOUSEHOLD_CAPACITY, PLAYER_HOME_BUILDING, SHARED_HOUSEHOLD_ID,
  assignHouseholds, ensureHouseholds, homeFor, householdIdFor, npcHomeBuildings,
} from '../city-households';
import { createCityLifeState, growCityPopulation } from '../city-life-create';
import { normalizeCityLife } from '../city-life-restore';
import { ensureCityLife } from '../city-life-state';
import { placeEntrance, routeTo } from '../city-life-movement';
import { placeOfBuilding } from '../city-npc-shift';
import { createCityScene } from '../city-scene';
import { createWorld } from '../templates';
import type { BuildingState } from '../building-types';

function residence(id: string, x: number, y: number): BuildingState {
  return createBuilding({
    id, name: id, kind: 'RESIDENCE',
    footprint: { x, y, w: 4, h: 3 }, entrance: { x: x + 2, y: y + 3 },
    interiorLayoutId: 'layout_grown_unit', locked: true,
  });
}

function worldWithHomes(homes: readonly BuildingState[]) {
  const world = createWorld('SMALL');
  const city = createCityScene();
  world.cityScene = { ...city, exterior: { ...city.exterior, buildings: [...CITY_PRESET_BUILDINGS, ...homes] } };
  ensureCityLife(world);
  return world;
}

describe('Wohnadresse und Haushalt', () => {
  it('verteilt Bewohner auf vorhandene NPC-Wohnhäuser statt auf die Spielerwohnung', () => {
    const first = residence('bld_grown_1', 4, 20);
    const second = residence('bld_grown_2', 40, 20);
    const world = worldWithHomes([first, second]);
    const residents = world.cityLife.residents;
    expect(residents).toHaveLength(3);
    expect(residents.every((resident) => resident.homeBuildingId !== PLAYER_HOME_BUILDING)).toBe(true);
    expect(new Set(residents.map((resident) => resident.homeBuildingId))).toEqual(
      new Set([first.id, second.id]),
    );
    for (const resident of residents) {
      expect(resident.householdId).toBe(householdIdFor(resident.homeBuildingId));
    }
    const counts = new Map<string, number>();
    for (const resident of residents) counts.set(resident.homeBuildingId, (counts.get(resident.homeBuildingId) ?? 0) + 1);
    expect([...counts.values()].every((count) => count <= HOUSEHOLD_CAPACITY)).toBe(true);
  });

  it('hält die gespeicherte Adresse, solange ihre Kapazität reicht', () => {
    const first = residence('bld_grown_1', 4, 20);
    const second = residence('bld_grown_2', 40, 20);
    const world = worldWithHomes([first, second]);
    const before = world.cityLife.residents;
    const pinned = before.map((resident, index) => index === 0
      ? { ...resident, homeBuildingId: second.id, householdId: householdIdFor(second.id) }
      : resident);
    const next = assignHouseholds(pinned, [...CITY_PRESET_BUILDINGS, first, second]);
    expect(next[0]).toBe(pinned[0]);
    expect(next[0]!.homeBuildingId).toBe(second.id);
  });

  it('verteilt auch eine größere Bewohnerschaft ohne Kapazitätsbruch', () => {
    const homes = [residence('bld_grown_1', 4, 20), residence('bld_grown_2', 40, 20)];
    const life = growCityPopulation(createCityLifeState(7), 6);
    const assigned = assignHouseholds(life.residents, [...CITY_PRESET_BUILDINGS, ...homes]);
    const counts = new Map<string, number>();
    for (const resident of assigned) {
      expect(npcHomeBuildings([...CITY_PRESET_BUILDINGS, ...homes]).map((home) => home.id)).toContain(resident.homeBuildingId);
      counts.set(resident.homeBuildingId, (counts.get(resident.homeBuildingId) ?? 0) + 1);
    }
    expect([...counts.values()].every((count) => count <= HOUSEHOLD_CAPACITY)).toBe(true);
  });

  it('migriert alte Saves ohne Adresse deterministisch nach', () => {
    const home = residence('bld_grown_1', 4, 20);
    const world = worldWithHomes([home]);
    const raw = JSON.parse(JSON.stringify(world.cityLife)) as Record<string, unknown>;
    const residents = (raw.residents as Record<string, unknown>[]).map(({ homeBuildingId: _h, householdId: _s, ...rest }) => rest);
    const restored = normalizeCityLife({ ...raw, residents });
    expect(restored.residents.every((resident) => resident.homeBuildingId === PLAYER_HOME_BUILDING)).toBe(true);
    world.cityLife = restored;
    ensureHouseholds(world);
    expect(world.cityLife.residents.every((resident) => resident.homeBuildingId === home.id)).toBe(true);
    expect(world.cityLife.residents.every((resident) => resident.householdId === householdIdFor(home.id))).toBe(true);
  });

  it('führt den Heimweg zur eigenen Haustür, nicht zur Spielerwohnung', () => {
    const home = residence('bld_grown_1', 4, 20);
    const world = worldWithHomes([home]);
    const resident = world.cityLife.residents[0]!;
    expect(homeFor(resident, world.cityScene!.exterior.buildings)).toBe(home.id);
    expect(placeOfBuilding(home.id, home.id)).toBe('HOME');
    expect(placeEntrance('HOME', home.id, world.cityScene!.exterior.buildings)).toEqual(home.entrance);
    expect(placeEntrance('HOME')).toEqual(CITY_PRESET_BUILDINGS[0]!.entrance);
    const path = routeTo(world.cityScene!, CITY_PRESET_BUILDINGS[0]!.entrance, 'HOME', home.id);
    expect(path.at(-1)).toEqual(home.entrance);
  });

  it('lässt den geteilten Ausweich-Haushalt ohne NPC-Wohnhaus sichtbar', () => {
    const world = createWorld('SMALL');
    ensureCityLife(world);
    for (const resident of world.cityLife.residents) {
      expect(resident.homeBuildingId).toBe(PLAYER_HOME_BUILDING);
      expect(resident.householdId).toBe(SHARED_HOUSEHOLD_ID);
    }
  });
});
