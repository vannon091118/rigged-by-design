/**
 * @test-target: src/core/sim/city-exterior.ts
 * @error-code: ERR-2001
 *
 * Die Fassaden sind sichtbar, also muessen sie auch begangen werden koennen wie
 * Gebaeude: Wandkanten am Grundriss, genau eine Tuer je Gebaeude. Ohne diesen
 * Vertrag laeuft die Figur durch das Bild hindurch, weil das Navigationsraster
 * nur Kanten und Moebel kennt.
 */
import { describe, expect, it } from 'vitest';
import { CITY_PRESET_BUILDINGS } from '../building';
import type { BuildingState } from '../building-types';
import { CITY_SPAWN } from '../city-scene';
import { cityBuildingWalls, createCityStreetLayout } from '../city-exterior';
import { edgeKey } from '../layout-edges';
import { navGrid, stepOpen, tileIndex } from '../nav-grid';
import { TILE } from '../types';

const layout = createCityStreetLayout();
const walls = layout.edges.filter((edge) => edge.kind === 'WALL');
const doors = layout.edges.filter((edge) => edge.kind === 'DOOR');
const wallKeys = new Set(walls.map((edge) => edgeKey(edge.axis, edge.x, edge.y)));

const perimeter = (building: BuildingState): Array<{ axis: 'H' | 'V'; x: number; y: number }> => {
  const { x, y, w, h } = building.footprint;
  const edges: Array<{ axis: 'H' | 'V'; x: number; y: number }> = [];
  for (let tx = x; tx < x + w; tx += 1) edges.push({ axis: 'H', x: tx, y }, { axis: 'H', x: tx, y: y + h });
  for (let ty = y; ty < y + h; ty += 1) edges.push({ axis: 'V', x, y: ty }, { axis: 'V', x: x + w, y: ty });
  return edges;
};

describe('Stadt: Fassaden sind auch Kollision', () => {
  it('umzaeunt jedes Gebaeude bis auf seine Tuer', () => {
    expect(walls.length).toBeGreaterThan(0);
    for (const building of CITY_PRESET_BUILDINGS) {
      const sides = perimeter(building).filter((edge) => !wallKeys.has(edgeKey(edge.axis, edge.x, edge.y)));
      expect(sides, `${building.id} hat offene Waende`).toEqual([{ axis: 'H', ...building.entrance }]);
    }
  });

  it('legt genau eine Tuer je Gebaeude auf dessen Grundriss', () => {
    expect(doors).toHaveLength(CITY_PRESET_BUILDINGS.length);
    for (const building of CITY_PRESET_BUILDINGS) {
      const own = doors.filter((door) => door.x === building.entrance.x && door.y === building.entrance.y);
      expect(own, `${building.id} ohne Tuer`).toHaveLength(1);
      expect(own[0]!.axis).toBe('H');
    }
  });

  it('haelt jede Kante eindeutig und den Spawn ausserhalb aller Grundrisse', () => {
    const keys = layout.edges.map((edge) => edgeKey(edge.axis, edge.x, edge.y));
    expect(new Set(keys).size).toBe(keys.length);
    for (const building of CITY_PRESET_BUILDINGS) {
      const { x, y, w, h } = building.footprint;
      expect(CITY_SPAWN.x >= x && CITY_SPAWN.x < x + w && CITY_SPAWN.y >= y && CITY_SPAWN.y < y + h).toBe(false);
    }
    expect(CITY_SPAWN).toEqual({ x: 8, y: 13 });
  });

  it('blockiert den Weg in das Haus und oeffnet genau die Schwelle', () => {
    const nav = navGrid(layout.size, [], layout);
    const home = CITY_PRESET_BUILDINGS[0]!;
    expect(stepOpen(nav, { x: home.entrance.x, y: home.entrance.y + 1 }, { x: home.entrance.x, y: home.entrance.y })).toBe(true);
    expect(stepOpen(nav, { x: home.entrance.x, y: home.entrance.y }, { x: home.entrance.x, y: home.entrance.y - 1 })).toBe(true);
    expect(stepOpen(nav, { x: home.entrance.x + 1, y: home.entrance.y }, { x: home.entrance.x + 1, y: home.entrance.y - 1 })).toBe(false);
    expect(stepOpen(nav, { x: home.entrance.x, y: home.footprint.y - 1 }, { x: home.entrance.x, y: home.footprint.y })).toBe(false);
    // Die belegten Tiles bleiben leer: die Kollision ist eine Kante, keine Sackgasse.
    expect(nav.blocked.size).toBe(0);
  });

  it('ist deterministisch und deckt die ganze Stadtflaeche ab', () => {
    const again = createCityStreetLayout();
    expect(again.edges).toEqual(layout.edges);
    expect(layout.size).toBe(60);
    expect(layout.floor).toHaveLength(60 * 60);
    expect(layout.floor[tileIndex(layout.size, 2, 14)]).toBe('CONCRETE');
    expect(60 * 60 * TILE).toBeGreaterThan(0);
  });

  it('berechnet die Wandkanten aus dem Grundriss, nicht aus dem Renderer', () => {
    const edges = cityBuildingWalls(CITY_PRESET_BUILDINGS);
    expect(edges).toHaveLength(walls.length);
    expect(new Set(edges.map((edge) => edgeKey(edge.axis, edge.x, edge.y))).size).toBe(edges.length);
    expect(edges.every((edge) => edge.kind === 'WALL' && edge.id === null)).toBe(true);
  });
});
