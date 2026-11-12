/**
 * Stabile Rollen fuer die Stadtflaechen. Kein Label-Regex, kein Farbwert als
 * Platzhalter: jede Rolle benennt eine echte Manifest-Textur.
 */
import type { BuildingKind } from '../core/sim/building-types';
import type { PropKind } from '../core/sim/city-exterior';
import { ASSET } from './assets/keys';

export type CitySurfaceRole =
  | 'APARTMENT'
  | 'PUB'
  | 'SHOP'
  | 'CASINO'
  | 'STREET_LIGHT'
  | 'BENCH'
  | 'TRASH_BIN'
  | 'BUS_STOP'
  | 'TREE'
  | 'DOOR';

interface CitySurfaceArt {
  readonly role: CitySurfaceRole;
  /** Relativ zu `ASSET`/`manifest.base`, nicht als frei geratener URL. */
  readonly asset: string;
}

/** Die vier preset-Gebaeude haben je eine Fassade; weitere Typen bleiben bewusst ohne. */
const CITY_BUILDING_ART: Readonly<Record<BuildingKind, CitySurfaceArt | null>> = {
  APARTMENT: { role: 'APARTMENT', asset: ASSET.city.apartment },
  RESIDENCE: null,
  PUB: { role: 'PUB', asset: ASSET.city.pub },
  SHOP: { role: 'SHOP', asset: ASSET.city.shop },
  CASINO: { role: 'CASINO', asset: ASSET.city.casino },
  OFFICE: null,
  WORKSHOP: null,
};

const CITY_PROP_ART: Readonly<Record<PropKind, CitySurfaceArt>> = {
  STREET_LIGHT: { role: 'STREET_LIGHT', asset: ASSET.city.streetLight },
  BENCH: { role: 'BENCH', asset: ASSET.city.bench },
  TRASH_BIN: { role: 'TRASH_BIN', asset: ASSET.city.trashBin },
  BUS_STOP: { role: 'BUS_STOP', asset: ASSET.city.busStop },
  TREE: { role: 'TREE', asset: ASSET.city.tree },
};

/** Tuerkanten teilen die Rollenquelle mit Fassaden und Requisiten. */
const CITY_DOOR_ART: CitySurfaceArt = { role: 'DOOR', asset: ASSET.city.door };

/**
 * Ein unbekannter Gebaeudetyp ist ein Vertragsbruch, kein Grund fuer eine
 * gruene Flaeche. Der Test deckt die preset-Typen ab; neue Typen muessen eine
 * Rolle und Textur mitbringen.
 */
export function cityBuildingArt(kind: BuildingKind): CitySurfaceArt {
  const art = CITY_BUILDING_ART[kind];
  if (!art) throw new Error(`[city] Keine Renderrolle fuer Gebaeudetyp ${kind}`);
  return art;
}

export function cityPropArt(kind: PropKind): CitySurfaceArt {
  return CITY_PROP_ART[kind];
}

export function cityDoorArt(): CitySurfaceArt {
  return CITY_DOOR_ART;
}
