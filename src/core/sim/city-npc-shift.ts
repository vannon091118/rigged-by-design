/**
 * @module city-npc-shift — Schichten sind eine Funktion der Kennung
 *
 * Eine Schicht braucht keinen Save: Sie liegt in einer Tabelle je Gebaeude und
 * wird ueber den Index der Figur gewaehlt. Die drei kuratierten Figuren behalten
 * ihre Schicht, jede weitere bekommt eine freie Schicht desselben Gebaeudes.
 * Dadurch ist Arbeit fuer jeden Bewohner moeglich, ohne dass ein Array pro
 * Person gepflegt wird, und ein alter Save braucht keine Migration.
 */
import type { CityLifePlace } from './city-life-types';
import { npcIndexById, rosterDefAt } from './city-npc-roster';
import { hourOfDay } from './clock';

export interface CitySlot {
  readonly id: string;
  readonly buildingId: string;
  readonly label: string;
  /** Schichtbeginn inklusive, Stunden 0..23. */
  readonly from: number;
  /** Schichtende exklusiv, Stunden 1..24; 24 heisst bis Mitternacht. */
  readonly to: number;
  readonly holderId: string;
}

/** Schaeden nicht: Die Schicht steht im Gebaeude, nicht im Score. */
const CURATED_SLOTS: readonly CitySlot[] = Object.freeze([
  { id: 'slot_pub_host', buildingId: 'bld_kiez_pub', label: 'Wirtin', from: 16, to: 24, holderId: 'rita' },
  { id: 'slot_shop_counter', buildingId: 'bld_corner_shop', label: 'Standaufseher', from: 7, to: 20, holderId: 'boris' },
  { id: 'slot_market_runner', buildingId: 'bld_corner_shop', label: 'Laeuferin', from: 9, to: 17, holderId: 'mira' },
]);

export const CITY_SLOTS = CURATED_SLOTS;

const PLACE_BUILDING: Readonly<Record<CityLifePlace, string>> = {
  HOME: 'bld_player_home',
  KIEZ: 'bld_kiez_pub',
  MARKT: 'bld_corner_shop',
  CASINO: 'bld_casino_grand',
};

export function buildingOfPlace(place: CityLifePlace): string {
  return PLACE_BUILDING[place];
}

/**
 * Rueckweg Gebaeude -> Ort. Der Tagesplan nennt ein Gebaeude; die Bewegung
 * braucht einen Ort. Ohne Treffer bleibt der Ort offen (kein Rateziel).
 */
export function placeOfBuilding(buildingId: string | null | undefined): CityLifePlace | null {
  if (!buildingId) return null;
  const entry = (Object.entries(PLACE_BUILDING) as [CityLifePlace, string][])
    .find(([, id]) => id === buildingId);
  return entry ? entry[0] : null;
}

/** Schichtfenster je Gebaeude; alle liegen innerhalb der Oeffnungszeiten. */
const SHIFT_WINDOWS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  bld_kiez_pub: [[16, 24], [17, 23], [18, 24], [16, 22]],
  bld_corner_shop: [[7, 15], [9, 17], [12, 20], [14, 22], [16, 24]],
  bld_casino_grand: [[18, 24], [20, 24], [22, 24], [19, 23]],
};

const SLOT_LABEL: Readonly<Record<string, string>> = {
  bld_kiez_pub: 'Kraft im Kiez',
  bld_corner_shop: 'Kraft am Markt',
  bld_casino_grand: 'Kraft im Casino',
};

/** Die Schicht dieser Figur; kuratierte Figuren behalten ihre. */
export function slotOf(npcId: string): CitySlot | null {
  const curated = CURATED_SLOTS.find((slot) => slot.holderId === npcId);
  if (curated) return curated;
  const index = npcIndexById(npcId);
  if (index === null) return null;
  // Der Ort steht in der Besetzung; die Schicht ist ein Fenster dieses Ortes.
  const buildingId = PLACE_BUILDING[rosterDefAt(index).location];
  const windows = SHIFT_WINDOWS[buildingId] ?? SHIFT_WINDOWS.bld_corner_shop!;
  const [from, to] = windows[index % windows.length]!;
  return {
    id: `slot_${buildingId.replace(/^bld_/, '')}_${index + 1}`,
    buildingId,
    label: SLOT_LABEL[buildingId] ?? 'Kraft',
    from,
    to,
    holderId: npcId,
  };
}

export function inShift(slot: CitySlot, hour: number): boolean {
  const normalized = hourOfDay(hour);
  return slot.from <= slot.to
    ? normalized >= slot.from && normalized < slot.to
    : normalized >= slot.from || normalized < slot.to;
}
