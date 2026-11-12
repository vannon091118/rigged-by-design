/**
 * Die vier Strassentueren und ihr bestehender Uebergang.
 *
 * Die IDs kommen aus `createCityStreetLayout()`; hier steht nur, wohin eine
 * Schwelle fuehrt. Wohnung und Casino sind eigene Szenen, Kiez und Markt sind
 * die vorhandenen Stadtorte. Damit hat jede der vier Tueren eine Wirkung,
 * ohne einen zweiten Szenengraphen zu erfinden.
 */
export const CITY_STREET_DOOR_IDS = [
  'door_street_to_player_apt',
  'door_street_to_kiez_pub',
  'door_street_to_corner_shop',
  'door_street_to_casino_grand',
] as const;

export type CityStreetDoorId = (typeof CITY_STREET_DOOR_IDS)[number];

export type CityDoorEffect =
  | { readonly kind: 'APARTMENT' }
  | { readonly kind: 'CASINO' }
  | { readonly kind: 'CITY_LOCATION'; readonly location: 'KIEZ' | 'MARKT' };

const EFFECTS: Readonly<Record<CityStreetDoorId, CityDoorEffect>> = Object.freeze({
  door_street_to_player_apt: Object.freeze({ kind: 'APARTMENT' }),
  door_street_to_kiez_pub: Object.freeze({ kind: 'CITY_LOCATION', location: 'KIEZ' }),
  door_street_to_corner_shop: Object.freeze({ kind: 'CITY_LOCATION', location: 'MARKT' }),
  door_street_to_casino_grand: Object.freeze({ kind: 'CASINO' }),
});

/** Unbekannte Tueren bleiben wirkungslos; keine geratene Zielszene. */
export function cityDoorEffect(doorId: string): CityDoorEffect | null {
  if (!Object.prototype.hasOwnProperty.call(EFFECTS, doorId)) return null;
  return EFFECTS[doorId as CityStreetDoorId];
}
