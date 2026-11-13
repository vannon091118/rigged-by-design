/**
 * @module city-life-movement — Weg, Dauer und Zwischenstand der Stadtbewohner
 *
 * Ein Ortswechsel ist keine Etikette: Der Bewohner steht auf einer Kachel, das
 * Ziel ist die Tür seines Gebäudes, der Weg kommt aus dem vorhandenen A*
 * (`findPath`) auf der echten Stadt-Navigation (`cityNav`) und wird pro Tick
 * abgelaufen. Ein unerreichbares Ziel wird protokolliert und nicht als
 * Teleport gebucht; der Bewohner bleibt stehen und versucht es später erneut.
 *
 * Welches Ziel ein Bewohner anläuft, entscheidet die Not: Hunger schickt ihn
 * zum Essen, Durst in die Kneipe, die Schicht an den Arbeitsplatz. Dieses Modul
 * kennt deshalb nur Ziele, keine Absichten — der Score bleibt die einzige
 * Entscheidungsstelle.
 */
import type { CitySceneState } from './city-scene';
import { cityNav } from './city-scene';
import { buildingById } from './city-life-venues';
import type { CityLifePlace } from './city-life-types';
import type { Point } from './types-model';
import { findPath, isWalkable, nearestWalkable } from './pathfinding';
import { ensureCityLife } from './city-life-state';
import { driftNeed } from './needs-core';
import { createCityScene } from './city-scene';
import type { WorldState } from './types';

/** Kacheln pro Tick: bei 25 Ticks je Stunde sind das 25 Kacheln je Stunde. */
export const TILES_PER_TICK = 1;
/**
 * Ankunft kostet Muedigkeit: je acht Kacheln ein Punkt. Der Weg ist damit
 * keine Etikette — ein weiter Umweg veraendert die naechste Entscheidung.
 * Gerechnet wird in ganzen Punkten, weil Beduerfnisse ganzzahlig gespeichert
 * werden und ein Rundungsrest sonst beim Laden verschwaende.
 */
const TILES_PER_FATIGUE = 8;
const travelFatigue = (pathLength: number): number =>
  Math.max(1, Math.round((pathLength - 1) / TILES_PER_FATIGUE));
/** Obergrenze je Aufruf, damit ein langer Tick nicht durch die Stadt springt. */
const MAX_STEPS = 8;

export interface CityTravel {
  readonly to: CityLifePlace;
  /** Weg inklusive Startkachel; `path[0]` ist die Position beim Aufbruch. */
  readonly path: readonly Point[];
  /** Index der zuletzt erreichten Kachel. */
  readonly index: number;
}

let sharedMap: CitySceneState | null = null;

/**
 * Die Stadtkarte ist statisch: Ein Bewohner, der in einem anderen Floor
 * simuliert wird, laeuft auf derselben Karte. Sie wird deshalb nicht in den
 * Weltzustand geschrieben, sondern einmal geteilt.
 */
export function cityMap(world: WorldState): CitySceneState {
  if (world.cityScene) return world.cityScene;
  sharedMap ??= createCityScene();
  return sharedMap;
}

/** Zielkachel eines Ortes: die Tür seines Gebäudes, sonst der Ort selbst. */
export function placeEntrance(place: CityLifePlace): Point | null {
  const building = buildingById(placeBuildingId(place));
  return building ? { ...building.entrance } : null;
}

function placeBuildingId(place: CityLifePlace): string {
  switch (place) {
    case 'HOME': return 'bld_player_home';
    case 'KIEZ': return 'bld_kiez_pub';
    case 'MARKT': return 'bld_corner_shop';
    case 'CASINO': return 'bld_casino_grand';
  }
}

/**
 * Route zu einem Ort. Ist die Tür versperrt, geht der Weg zur nächsten freien
 * Kachel davor; ist auch das unmöglich, gibt es keinen Weg (kein Teleport).
 */
export function routeTo(city: CitySceneState, from: Point, place: CityLifePlace): Point[] {
  const nav = cityNav(city);
  const start = isWalkable(nav, from.x, from.y) ? from : nearestWalkable(nav, from);
  if (!start) return [];
  const entrance = placeEntrance(place);
  if (!entrance) return [];
  const goal = nearestWalkable(nav, entrance);
  if (!goal) return [];
  return findPath(nav, start, goal);
}

/**
 * Aufbruch zu einem Ort. `here` heisst: schon an der Tür, der Ort gilt sofort.
 * `travel: null` ohne `here` heisst: kein Weg, also kein Teleport.
 */
export function startTravel(
  position: Point, city: CitySceneState, place: CityLifePlace,
): { readonly travel: CityTravel | null; readonly here: boolean } {
  const path = routeTo(city, position, place);
  if (path.length === 0) return { travel: null, here: false };
  if (path.length === 1) return { travel: null, here: true };
  return { travel: { to: place, path, index: 0 }, here: false };
}

/**
 * Ein Tick Bewegung. Rückgabe ist der neue Stand; `arrived` sagt, ob der Weg in
 * diesem Tick zu Ende ging. Es wird nie mehr als `steps` Kacheln gesprungen.
 */
export function advanceTravel(
  travel: CityTravel, steps = TILES_PER_TICK,
): { readonly travel: CityTravel | null; readonly position: Point; readonly arrived: boolean } {
  const limit = travel.path.length - 1;
  const index = Math.min(limit, travel.index + Math.max(1, Math.min(MAX_STEPS, Math.floor(steps))));
  const position = travel.path[index]!;
  if (index >= limit) return { travel: null, position, arrived: true };
  return { travel: { ...travel, index }, position, arrived: false };
}

/** Restweg in Kacheln; 0 heisst angekommen. */
export function remainingTiles(travel: CityTravel | null): number {
  if (!travel) return 0;
  return Math.max(0, travel.path.length - 1 - travel.index);
}

/**
 * Ein Tick für alle Bewohner. Der Ort wechselt erst bei Ankunft; bis dahin
 * bleibt der alte Ort stehen und die Sicht meldet „unterwegs nach X".
 */
export function tickCityMovement(world: WorldState): void {
  const life = ensureCityLife(world);
  if (!life.residents.some((resident) => resident.travel !== null)) return;
  const residents = life.residents.map((resident) => {
    if (!resident.travel) return resident;
    const step = advanceTravel(resident.travel);
    if (!step.arrived) {
      return { ...resident, position: step.position, travel: step.travel };
    }
    const fatigue = driftNeed(resident.needs.fatigue, travelFatigue(resident.travel.path.length));
    return {
      ...resident, needs: { ...resident.needs, fatigue },
      position: step.position, travel: null, location: resident.travel.to,
    };
  });
  world.cityLife = { ...life, residents };
}
