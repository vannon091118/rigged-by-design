/**
 * @module city-roads — Fahrbahnmaske der Stadt
 *
 * Die Straßen sind öffentlicher Grund: Der Boden malt sie, das Grundstücks­
 * register prüft gegen sie. Die Maske steht fest, bevor Gebäude ihre Fläche
 * bemalen — deshalb kann kein Gebäude eine Fahrbahn verdecken, und der
 * Register-Guard bleibt sichtbar, auch wenn der Boden darüber schon WOOD ist.
 */
import type { BuildingFootprint } from './building-types';
import type { Point } from './types-model';

/** Kantenlänge des Stadt-Rasters in Kacheln; Boden und Plätze teilen sie. */
export const CITY_GRID_SIZE = 60;

interface RoadRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Die Fahrbahnen: Ost-West-Trasse und die Querstraße nach Süden. */
export const CITY_ROAD_RECTS: readonly RoadRect[] = Object.freeze([
  Object.freeze({ x: 0, y: 14, w: CITY_GRID_SIZE, h: 5 }),
  Object.freeze({ x: 28, y: 14, w: 5, h: 36 }),
]);

const inRect = (rect: RoadRect, x: number, y: number): boolean =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

/** Liegt diese Kachel auf einer Fahrbahn? */
export function isCityRoadTile(x: number, y: number): boolean {
  return CITY_ROAD_RECTS.some((rect) => inRect(rect, x, y));
}

/**
 * Die Fahrbahnkacheln einer Fläche. Eine leere Liste heisst: die Fläche ist
 * frei von öffentlichem Grund.
 */
export function roadTilesIn(rect: BuildingFootprint): Point[] {
  const tiles: Point[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (isCityRoadTile(x, y)) tiles.push({ x, y });
    }
  }
  return tiles;
}
