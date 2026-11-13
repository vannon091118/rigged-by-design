/**
 * Stadt als begehbarer Floor. Die Stadtkarte bleibt eine Uebersicht; dieser
 * Plan ist die Projektion, auf der die Figur tatsaechlich steht. Die Quelle
 * ist `createCityExteriorModel()`: 60x60 Strassen, Gebaeude und Requisiten
 * werden nicht als zweite Stadtkopie gepflegt.
 */
import {
  createCityExteriorModel,
  STREET_PROP_FOOTPRINTS,
  streetPropFootprintTiles,
  type CityExteriorModel,
  type StreetProp,
} from './city-exterior';
import type { LayoutState } from './layout-types';
import { navGrid, tileIndex, withBlocked, type NavGrid } from './nav-grid';
import type { Furniture, Point, Zone } from './types-model';

/** Alles aus dem Aussenwelt-Modell ausser dem Layout; das Layout bleibt oben. */
type CityExteriorState = Omit<CityExteriorModel, 'layout'>;

export interface CitySceneState {
  readonly layout: LayoutState;
  readonly zones: Zone[];
  readonly furniture: Furniture[];
  /** Anzeigedaten der einen Stadtwahrheit; kein zweiter Szenengraph. */
  readonly exterior: CityExteriorState;
}

/**
 * Die Stadt hat keine Portal-Furniture mehr: Gebaeude, Tueren und Requisiten
 * kommen aus dem Exterieur-Modell. Die frueheren Menue-Portale waren eine
 * zweite, 30x30 grosse Stadtkopie und hatten keinen Renderer.
 */
export function createCityScene(): CitySceneState {
  const exterior = createCityExteriorModel();
  const layout = exterior.layout;
  return {
    layout,
    zones: [...layout.zones],
    furniture: [],
    exterior: {
      layoutId: exterior.layoutId,
      name: exterior.name,
      buildings: exterior.buildings,
      props: exterior.props,
      playerApartmentStreetSpawn: exterior.playerApartmentStreetSpawn,
    },
  };
}

/**
 * Alte Saves tragen noch die 30x30-Projektion aus der Vorlage. Sie wird beim
 * Laden einmal auf das echte Exterieur gehoben; neue Saves behalten ihre
 * statische Stadtkopie, damit IDs und Eingaenge stabil bleiben.
 */
export function normalizeCityScene(raw?: CitySceneState | null): CitySceneState {
  if (!raw || !raw.exterior || raw.layout?.size !== 60) return createCityScene();
  if (!Array.isArray(raw.exterior.buildings) || !Array.isArray(raw.exterior.props)) return createCityScene();
  // Alte Saves tragen nur die Position. Der Fussabdruck kommt aus derselben
  // Tabelle wie beim Neubau, damit Nav und Bild auch nach dem Laden passen.
  const source: readonly StreetProp[] = raw.exterior.props;
  const props = source.map((prop) =>
    prop.footprint ? prop : { ...prop, footprint: STREET_PROP_FOOTPRINTS[prop.kind] },
  );
  // Die Zonenkopie ist nur eine Ableitung. Weicht sie vom Layout ab, gewinnt
  // das Layout — sonst zeigten Boden und Rollen zwei verschiedene Staedte.
  const zones = sameZones(raw.zones, raw.layout.zones) ? raw.zones : [...raw.layout.zones];
  const propsChanged = props.some((prop, index) => prop !== source[index]);
  if (!propsChanged && zones === raw.zones) return raw;
  return { ...raw, zones, exterior: { ...raw.exterior, props } };
}

/** Zonen sind gleich, wenn jede Geometrie und Art uebereinstimmt. */
function sameZones(left: readonly Zone[], right: readonly Zone[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((zone, index) => {
    const other = right[index]!;
    return zone.kind === other.kind && zone.x === other.x && zone.y === other.y
      && zone.w === other.w && zone.h === other.h;
  });
}

const NAV_CACHE = new WeakMap<CitySceneState, NavGrid>();

/**
 * Die Stadt-Navigation ist mehr als das Layout: Requisiten belegen ihren
 * Fussabdruck, damit Bild und Weg dieselbe Flaeche meinen. Der Cache haengt an
 * der Szene; eine neue Stadt baut genau einmal neu.
 */
export function cityNav(city: CitySceneState): NavGrid {
  const cached = NAV_CACHE.get(city);
  if (cached) return cached;
  const base = navGrid(city.layout.size, city.furniture, city.layout);
  const tiles = city.exterior.props
    .flatMap(streetPropFootprintTiles)
    .map((tile) => tileIndex(base.size, tile.x, tile.y));
  const nav = tiles.length > 0 ? withBlocked(base, tiles) : base;
  NAV_CACHE.set(city, nav);
  return nav;
}

/** Der Spieler betritt die Stadt vor seiner Haustuer, nicht auf der alten 2,2-Kachel. */
export const CITY_SPAWN: Point = { x: 8, y: 13 };
