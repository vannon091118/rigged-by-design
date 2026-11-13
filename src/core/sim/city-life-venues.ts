/**
 * @module city-life-venues — Gebäude, Öffnungszeiten und Job-Slots
 *
 * Die Stadt ist die einzige Wahrheit über Zeiten: Ein Gebäude trägt seine
 * Öffnungszeiten (`BuildingState.operatingHours`), ein Job-Slot trägt seine
 * Schicht und seinen Inhaber. Der Stadtleben-Score liest beides, statt eine
 * eigene Stundentabelle zu pflegen — neue Gebäude und Slots wirken dadurch
 * global, ohne dass eine Entscheidungsdatei angefasst wird.
 *
 * Ein Slot ohne Inhaber ist offen: dort kann später der Spieler oder ein neuer
 * Bewohner einsteigen. Genau diese Lücke trägt das Wachstum der Stadt.
 */
import { CITY_PRESET_BUILDINGS, isBuildingOpen } from './building';
import type { BuildingState } from './building-types';
import type { CityLifePlace } from './city-life-types';

export interface CitySlot {
  readonly id: string;
  readonly buildingId: string;
  readonly label: string;
  /** Schichtbeginn inklusive, Stunden 0..23. */
  readonly from: number;
  /** Schichtende exklusiv, Stunden 1..24; 24 heisst bis Mitternacht. */
  readonly to: number;
  /** Inhaber des Slots; `null` heisst: frei und damit besetzbar. */
  readonly holderId: string | null;
}

/**
 * Die Schichten der benannten Bewohner. Sie stehen neben den Gebäuden, nicht im
 * Score: Wer arbeitet, arbeitet in seiner Schicht, und die Schicht liegt
 * innerhalb der Öffnungszeit ihres Gebäudes.
 */
export const CITY_SLOTS: readonly CitySlot[] = Object.freeze([
  { id: 'slot_pub_host', buildingId: 'bld_kiez_pub', label: 'Wirtin', from: 16, to: 24, holderId: 'rita' },
  { id: 'slot_shop_counter', buildingId: 'bld_corner_shop', label: 'Standaufseher', from: 7, to: 20, holderId: 'boris' },
  { id: 'slot_market_runner', buildingId: 'bld_corner_shop', label: 'Laeuferin', from: 9, to: 17, holderId: 'mira' },
]);

/** Gebäude, in dem ein Stadtort liegt; ohne Eintrag ist der Ort privat. */
const PLACE_BUILDING: Readonly<Record<CityLifePlace, string | null>> = {
  HOME: 'bld_player_home',
  KIEZ: 'bld_kiez_pub',
  MARKT: 'bld_corner_shop',
  CASINO: 'bld_casino_grand',
};

export function buildingById(id: string): BuildingState | null {
  return CITY_PRESET_BUILDINGS.find((building) => building.id === id) ?? null;
}

export function venueAt(place: CityLifePlace): BuildingState | null {
  const id = PLACE_BUILDING[place];
  return id ? buildingById(id) : null;
}

/** Öffnungszeit eines Ortes; ohne Gebäude oder ohne Zeiten ist er immer offen. */
export function venueOpenAt(place: CityLifePlace, hour: number): boolean {
  const venue = venueAt(place);
  return venue ? isBuildingOpen(venue, hour) : true;
}

/** Der Slot, den dieser Bewohner hält; ohne Slot arbeitet er nirgends. */
export function slotOf(npcId: string): CitySlot | null {
  return CITY_SLOTS.find((slot) => slot.holderId === npcId) ?? null;
}

export function inShift(slot: CitySlot, hour: number): boolean {
  const normalized = ((hour % 24) + 24) % 24;
  return slot.from <= slot.to
    ? normalized >= slot.from && normalized < slot.to
    : normalized >= slot.from || normalized < slot.to;
}

/**
 * Darf dieser Bewohner zu dieser Stunde arbeiten? Nur in seiner Schicht und nur,
 * solange sein Gebäude geöffnet hat. Ohne Slot gibt es keine Arbeit.
 */
export function workAllowedAt(npcId: string, hour: number): boolean {
  const slot = slotOf(npcId);
  if (!slot) return false;
  const venue = buildingById(slot.buildingId);
  if (venue && !isBuildingOpen(venue, hour)) return false;
  return inShift(slot, hour);
}
