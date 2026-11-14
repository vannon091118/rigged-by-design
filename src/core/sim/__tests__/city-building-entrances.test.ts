/**
 * @test-target: src/core/sim/building.ts
 * @error-code: ERR-2001
 *
 * Eine Nordzeile, eine Fassadenzeile: Jede Tuer liegt auf der Gehweg-Zeile des
 * eigenen Grundrisses, keine auf der Fahrbahn. Vor #574 war die Kneipe zwei
 * Zeilen tiefer als Wohnhaus und Späti gebaut; ihre Tuer stand auf der
 * Hauptstrasse statt auf dem Gehweg.
 */
import { describe, expect, it } from 'vitest';
import { CITY_PRESET_BUILDINGS } from '../building';
import { createCityStreetLayout } from '../city-exterior';
import { CITY_ROAD_RECTS, roadTilesIn } from '../city-roads';

const layout = createCityStreetLayout();
const zoneAt = (x: number, y: number) =>
  layout.zones.find((zone) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) ?? null;
const firstRoadRow = Math.min(...CITY_ROAD_RECTS.map((road) => road.y));

describe('Stadt: Eingangs-Konvention', () => {
  it('legt jede Tuer auf eine H-Kante des eigenen Grundrisses', () => {
    for (const building of CITY_PRESET_BUILDINGS) {
      const { x, y, w, h } = building.footprint;
      expect(building.entrance.y === y || building.entrance.y === y + h, building.id).toBe(true);
      expect(building.entrance.x >= x && building.entrance.x < x + w, building.id).toBe(true);
    }
  });

  it('legt keine Tuer auf die Fahrbahn', () => {
    for (const building of CITY_PRESET_BUILDINGS) {
      const tile = { x: building.entrance.x, y: building.entrance.y, w: 1, h: 1 };
      expect(roadTilesIn(tile), building.id).toEqual([]);
    }
  });

  it('legt jede Tuer in eine Gehweg- oder Vorplatz-Zone', () => {
    for (const building of CITY_PRESET_BUILDINGS) {
      const zone = zoneAt(building.entrance.x, building.entrance.y);
      expect(zone, building.id).not.toBeNull();
      expect(['LOUNGE', 'ENTRANCE'], building.id).toContain(zone!.kind);
    }
  });

  it('richtet alle Gebaeude der Nordzeile auf dieselbe Fassadenzeile aus', () => {
    const north = CITY_PRESET_BUILDINGS.filter((building) => building.footprint.y < firstRoadRow);
    expect(north.length).toBeGreaterThan(1);
    expect(new Set(north.map((building) => building.footprint.y + building.footprint.h)).size).toBe(1);
    // Die gemeinsame Fassade steht auf der ersten Gehweg-Zeile, nicht auf der Strasse.
    expect(north[0]!.footprint.y + north[0]!.footprint.h).toBe(firstRoadRow - 2);
    for (const building of north) expect(building.entrance.y).toBe(building.footprint.y + building.footprint.h);
  });

  it('haelt jeden Grundriss aus der Fahrbahn heraus', () => {
    for (const building of CITY_PRESET_BUILDINGS) {
      expect(roadTilesIn(building.footprint), building.id).toEqual([]);
    }
  });
});
