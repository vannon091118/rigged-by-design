/** Szenen-Kopf des Snapshots: eine Stelle, die alle Szenen benennt. */
import type { WorldState } from '../core/sim/types';
import type { InteriorDef } from '../core/sim/interior-layouts';
import type { GameView } from './types';

export function projectScene(
  world: WorldState,
  interior: InteriorDef | null,
  hasApartment: boolean,
  hasCity: boolean,
  foreignId: number | null,
): GameView['scene'] {
  if (interior) return { key: `INTERIOR:${interior.buildingId}`, kind: 'INTERIOR', label: interior.name };
  if (hasApartment) return { key: 'APARTMENT', kind: 'APARTMENT', label: 'Wohnung' };
  if (hasCity) return { key: 'CITY', kind: 'CITY', label: 'Stadt' };
  if (foreignId !== null) {
    const rival = world.foreignFloors.find((floor) => floor.id === foreignId)?.rivalId ?? 'unbekannt';
    return { key: `FOREIGN:${foreignId}`, kind: 'FOREIGN', label: `Fremdes Casino: ${rival}` };
  }
  return { key: 'OWN', kind: 'OWN', label: 'Dein Casino' };
}
