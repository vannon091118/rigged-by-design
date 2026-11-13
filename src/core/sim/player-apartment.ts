/**
 * Kanonisches Layout und Einrichtungs-Modell der Spieler-Wohnung.
 *
 * Der Spieler startet nicht im Casino, sondern in seiner eigenen Wohnung:
 * Aufwachen im Schlafbereich, Kochnische, Bad, Wohnbereich und Flur mit Haustür.
 */
import { ZERO_VC } from '../economy/vacoin';
import { apartmentEdges } from './apartment-walls';
import type { FloorMaterialId, LayoutState, LayoutZone } from './layout-types';
import { navGrid, type NavGrid } from './nav-grid';
import type { Furniture, Point } from './types-model';

export type ApartmentFurnitureKind =
  | 'BED' | 'WARDROBE' | 'SOFA' | 'TABLE' | 'KITCHEN_COUNTER' | 'FRIDGE' | 'TOILET' | 'SINK' | 'SMARTPHONE';

export interface ApartmentFurnitureItem {
  readonly id: string;
  readonly name: string;
  readonly kind: ApartmentFurnitureKind;
  /** Stabile Kunst-ID; Renderrollen lesen sie statt des Anzeigenamens. */
  readonly artId: string;
  readonly position: Point;
  readonly interactive: boolean;
  readonly description: string;
}

export interface PlayerApartmentModel {
  readonly layoutId: string;
  readonly name: string;
  readonly layout: LayoutState;
  readonly exitDoor: Point;
  readonly bedSpawn: Point;
  readonly furniture: readonly ApartmentFurnitureItem[];
}

/**
 * Erzeugt das kanonische Layout der Spieler-Wohnung (16x16 Raster).
 * Begehbar sind 10x10 Tiles: eine enge Starterwohnung, kein halber Casino-Saal.
 */
export function createPlayerApartmentLayout(): LayoutState {
  const size = 16;
  const floor: FloorMaterialId[] = new Array<FloorMaterialId>(size * size).fill('CONCRETE');

  for (let y = 3; y < 13; y += 1) {
    for (let x = 3; x < 13; x += 1) {
      const idx = y * size + x;
      if (x < 8 && y < 8) floor[idx] = 'CARPET';
      else if (x >= 8 && y < 8) floor[idx] = 'WOOD';
      else if (x < 7 && y >= 8) floor[idx] = 'TILE';
      else if (x >= 7 && x < 10 && y >= 8) floor[idx] = 'LINOLEUM';
      else floor[idx] = 'STONE';
    }
  }

  const zones: LayoutZone[] = [
    { id: 'apt_zone_bedroom', name: 'Schlafzimmer', kind: 'LOUNGE', x: 3, y: 3, w: 5, h: 5, color: 0x3b82f6 },
    { id: 'apt_zone_living', name: 'Wohnbereich', kind: 'LOUNGE', x: 8, y: 3, w: 5, h: 5, color: 0x10b981 },
    { id: 'apt_zone_bathroom', name: 'Badezimmer', kind: 'TOILET', x: 3, y: 8, w: 4, h: 5, color: 0x06b6d4 },
    { id: 'apt_zone_kitchen', name: 'Kochnische', kind: 'BAR', x: 7, y: 8, w: 3, h: 5, color: 0xf59e0b },
    { id: 'apt_zone_hallway', name: 'Wohnungsflur', kind: 'ENTRANCE', x: 10, y: 8, w: 3, h: 5, color: 0x8b5cf6 },
  ];

  // Waende und Durchgaenge kommen aus der Kantenliste, nicht aus einer zweiten Karte.
  return Object.freeze({ size, floor: Object.freeze(floor), zones: Object.freeze(zones), edges: apartmentEdges() });
}

const APARTMENT_FURNITURE_RAW: readonly [string, string, ApartmentFurnitureKind, number, number, boolean, string][] = [
  ['furn_player_bed', 'Eigenes Bett', 'BED', 4, 4, true, 'Hier erwachst du zu Beginn eines jeden neuen Tages.'],
  ['furn_player_wardrobe', 'Kleiderschrank', 'WARDROBE', 6, 3, true, 'Zum Wechseln von Kleidung und Habseligkeiten.'],
  ['furn_player_smartphone', 'Smartphone', 'SMARTPHONE', 5, 4, true, 'Nachrichten, Kontakte und Benachrichtigungen.'],
  ['furn_player_sofa', 'Sofa', 'SOFA', 9, 4, true, 'Bequemer Platz zum Ausruhen und Nachdenken.'],
  ['furn_player_table', 'Wohnzimmertisch', 'TABLE', 10, 5, false, 'Ein einfacher Holztisch mit Notizen.'],
  ['furn_player_fridge', 'Kühlschrank', 'FRIDGE', 7, 9, true, 'Kühle Getränke und Vorräte gegen Hunger und Durst.'],
  ['furn_player_kitchen_counter', 'Kochnische mit Spüle', 'KITCHEN_COUNTER', 8, 9, true, 'Einfache Küchenzeile.'],
  ['furn_player_toilet', 'Toilette', 'TOILET', 4, 12, true, 'Badezimmer-Ausstattung.'],
  ['furn_player_sink', 'Waschbecken & Spiegel', 'SINK', 6, 12, true, 'Morgendliche Frische vor dem Hinaustreten.'],
];

const APARTMENT_FURNITURE_ID_BASE = 30_000;

let cachedModel: PlayerApartmentModel | null = null;
let cachedFurniture: readonly Furniture[] | null = null;

/** Erzeugt das vollständige Modell der Spieler-Wohnung inklusive Möbel und Spawnpunkt. */
export function createPlayerApartmentModel(): PlayerApartmentModel {
  const layout = createPlayerApartmentLayout();
  const furniture = APARTMENT_FURNITURE_RAW.map(([id, name, kind, x, y, interactive, description]) =>
    Object.freeze({
      id, name, kind, artId: `apartment:${kind.toLowerCase()}`,
      position: Object.freeze({ x, y }), interactive, description,
    }),
  );

  return Object.freeze({
    layoutId: 'layout_player_apartment',
    name: 'Wohnung des Spielers',
    layout,
    exitDoor: Object.freeze({ x: 11, y: 13 }),
    bedSpawn: Object.freeze({ x: 5, y: 5 }),
    furniture: Object.freeze(furniture),
  });
}

/** Ein kanonisches Modell fuer Projektion, Navigation und Start; nie neu berechnet. */
export function playerApartmentModel(): PlayerApartmentModel {
  cachedModel ??= createPlayerApartmentModel();
  return cachedModel;
}

function zoneAt(layout: LayoutState, point: Point): string {
  return layout.zones.find((zone) =>
    point.x >= zone.x && point.y >= zone.y
    && point.x < zone.x + zone.w && point.y < zone.y + zone.h)?.id ?? 'apt_zone_hallway';
}

/**
 * Wohnungsmöbel in der gemeinsamen Sichtform. Sie stehen auf einem Tile, sind
 * keine Spielfläche und tragen keinen Preis; Navigation und Renderer lesen
 * dieselbe Liste.
 */
export function playerApartmentFurniture(): readonly Furniture[] {
  if (cachedFurniture) return cachedFurniture;
  const model = playerApartmentModel();
  cachedFurniture = Object.freeze(model.furniture.map((item, index) => Object.freeze({
    id: APARTMENT_FURNITURE_ID_BASE + index,
    kind: 'DECOR' as const,
    x: item.position.x,
    y: item.position.y,
    w: 1,
    h: 1,
    seats: 0,
    label: item.name,
    artId: item.artId,
    price: ZERO_VC,
    quality: 100,
    condition: 100,
    damaged: false,
    dirt: 0,
    stock: 0,
    clog: 0,
    clogged: false,
    zoneId: zoneAt(model.layout, item.position),
    occupants: [],
    mods: [],
    reels: 3,
    baseBet: ZERO_VC,
  })));
  return cachedFurniture;
}

/** Das Navigationsraster der Wohnung: eigener Plan, eigene Möbel, keine Casino-Wände. */
export function playerApartmentNav(): NavGrid {
  const model = playerApartmentModel();
  return navGrid(model.layout.size, playerApartmentFurniture(), model.layout);
}
