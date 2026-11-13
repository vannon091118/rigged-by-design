/**
 * @module city-life-venues — Gebäude, Öffnungszeiten und Zugang zur Arbeit
 *
 * Die Stadt ist die einzige Wahrheit über Zeiten: Ein Gebäude trägt seine
 * Öffnungszeiten (`BuildingState.operatingHours`), ein Job-Slot trägt seine
 * Schicht und seinen Inhaber. Der Stadtleben-Score liest beides, statt eine
 * eigene Stundentabelle zu pflegen — neue Gebäude wirken dadurch global, ohne
 * dass eine Entscheidungsdatei angefasst wird.
 *
 * Schichten selbst liegen in `city-npc-shift`: Sie folgen aus der Kennung, damit
 * jeder Bewohner arbeiten kann, auch der zehnte.
 */
import { CITY_PRESET_BUILDINGS, isBuildingOpen } from './building';
import type { BuildingState } from './building-types';
import type { CityLifePlace } from './city-life-types';
import { buildingOfPlace, inShift, slotOf } from './city-npc-shift';

export { CITY_SLOTS, inShift, slotOf } from './city-npc-shift';
export type { CitySlot } from './city-npc-shift';

export function buildingById(id: string): BuildingState | null {
  return CITY_PRESET_BUILDINGS.find((building) => building.id === id) ?? null;
}

function venueAt(place: CityLifePlace): BuildingState | null {
  return buildingById(buildingOfPlace(place));
}

/** Öffnungszeit eines Ortes; ohne Gebäude oder ohne Zeiten ist er immer offen. */
export function venueOpenAt(place: CityLifePlace, hour: number): boolean {
  const venue = venueAt(place);
  return venue ? isBuildingOpen(venue, hour) : true;
}

/**
 * Darf dieser Bewohner zu dieser Stunde arbeiten? Nur in seiner Schicht und nur,
 * solange sein Gebäude geöffnet hat. Ohne Schicht gibt es keine Arbeit.
 */
export function workAllowedAt(npcId: string, hour: number): boolean {
  const slot = slotOf(npcId);
  if (!slot) return false;
  const venue = buildingById(slot.buildingId);
  if (venue && !isBuildingOpen(venue, hour)) return false;
  return inShift(slot, hour);
}
