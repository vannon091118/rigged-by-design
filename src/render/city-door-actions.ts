/** Stadtschwellen: die Tuer ist ein Ziel wie jedes andere; der Effekt kommt aus city-doors. */
import { cityDoorEffect, grownDoorBuilding, type CityStreetDoorId } from '../core/sim/city-doors';
import { isShell } from '../core/sim/city-construction';
import type { GameView } from '../store/types';
import type { MenuAction } from './floor-actions';

const DOOR_LABELS: Readonly<Record<CityStreetDoorId, string>> = Object.freeze({
  door_street_to_player_apt: 'Wohnung betreten',
  door_street_to_casino_grand: 'Casino betreten',
  door_street_to_kiez_pub: 'Kneipe betreten',
  door_street_to_corner_shop: 'Laden betreten',
});

/** Die Schwelle ist ein Ziel wie jedes andere; der Effekt kommt aus city-doors. */
export function buildDoorActions(view: GameView, doorId: string): MenuAction[] {
  if (view.scene.kind !== 'CITY') return [];
  // Neubauten: Der Rohbau ist Kulisse, der fertige Laden oeffentlich, das
  // fertige Wohnhaus privat. Die Aktion nennt den Grund statt zu fehlen (#524).
  const grown = grownDoorBuilding(doorId, view.cityExterior?.buildings ?? []);
  if (grown) {
    if (isShell(grown)) return [];
    if (grown.kind === 'RESIDENCE') {
      return [{ id: 'ENTER_DOOR', label: 'Wohnhaus betreten', enabled: false, doorId, reason: 'Privatwohnung — kein öffentlicher Zugang.' }];
    }
    const marketLocked = view.city.locations.find((entry) => entry.id === 'MARKT')?.locked ?? false;
    return [{
      id: 'ENTER_DOOR',
      label: 'Laden betreten',
      enabled: !marketLocked,
      doorId,
      reason: marketLocked ? 'Der Markt öffnet erst ab Kiez-Rang Stammgast.' : undefined,
    }];
  }
  const effect = cityDoorEffect(doorId);
  const label = DOOR_LABELS[doorId as CityStreetDoorId];
  if (!effect || !label) return [];
  const locked = effect.kind === 'CITY_LOCATION'
    ? view.city.locations.find((entry) => entry.id === effect.location)?.locked ?? false
    : false;
  return [{
    id: 'ENTER_DOOR',
    label,
    enabled: !locked,
    doorId,
    reason: locked ? 'Der Markt öffnet erst ab Kiez-Rang Stammgast.' : undefined,
  }];
}
