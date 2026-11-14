/**
 * @module interior-layouts — begehbare Innenräume der Stadtgebäude
 *
 * Kneipe und Späti tragen am Gebäude eine `interiorLayoutId`. Hier liegt der
 * zugehörige Grundriss: eine 12x10-Fläche mit Wänden, einer Tür zur Straße,
 * Zonen und Möbeln. Der Raum wird deterministisch erzeugt, nicht gespeichert;
 * im Save steht nur, welcher Innenraum gerade aktiv ist.
 */
import type { FloorMaterialId, LayoutEdge, LayoutState, LayoutZone } from './layout-types';
import type { Furniture, Point } from './types-model';
import type { VaCoinMicro } from '../economy/vacoin';

type InteriorKind = 'PUB' | 'SHOP';

export interface InteriorDef {
  readonly kind: InteriorKind;
  readonly buildingId: string;
  readonly layoutId: string;
  readonly name: string;
  readonly layout: LayoutState;
  readonly furniture: readonly Furniture[];
  /** Zwei Kacheln vor der Tür; der Spieler steht beim Betreten hier. */
  readonly spawn: Point;
  /** Kachel direkt an der Tür: wer sie betritt, geht zurück auf die Straße. */
  readonly exitTile: Point;
  /** Schwelle auf der Straße, auf der der Spieler wieder ankommt. */
  readonly streetDoor: Point;
}

const SIZE = 12;
const HEIGHT = 10;
const DOOR_X = 5;

const PRICE = 0 as VaCoinMicro;

function furniture(
  id: number, kind: Furniture['kind'], x: number, y: number, w: number, h: number,
  label: string, zoneId: string, seats = 0, stock = 0,
): Furniture {
  return {
    id, kind, x, y, w, h, seats, label, price: PRICE, quality: 1,
    condition: 100, damaged: false, dirt: 0, stock, clog: 0, clogged: false,
    zoneId, occupants: [], mods: [], reels: 3, baseBet: PRICE,
  };
}

/** Wände ringsum, offen nur an der Straßentür. */
function edges(): readonly LayoutEdge[] {
  const result: LayoutEdge[] = [];
  for (let x = 0; x < SIZE; x += 1) {
    result.push({ axis: 'H', x, y: 0, kind: 'WALL', id: null, zoneId: null });
    result.push(x === DOOR_X
      ? { axis: 'H', x, y: HEIGHT, kind: 'DOOR', id: 'door_interior_exit', zoneId: 'interior_zone_door' }
      : { axis: 'H', x, y: HEIGHT, kind: 'WALL', id: null, zoneId: null });
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    result.push({ axis: 'V', x: 0, y, kind: 'WALL', id: null, zoneId: null });
    result.push({ axis: 'V', x: SIZE, y, kind: 'WALL', id: null, zoneId: null });
  }
  return Object.freeze(result);
}

function layout(floorId: FloorMaterialId, zones: readonly LayoutZone[]): LayoutState {
  return Object.freeze({
    size: SIZE,
    floor: Object.freeze(Array.from({ length: SIZE * HEIGHT }, () => floorId)),
    zones: Object.freeze(zones),
    edges: edges(),
  });
}

const PUB_ZONES: readonly LayoutZone[] = Object.freeze([
  { id: 'interior_zone_bar', name: 'Theke', kind: 'BAR', x: 2, y: 1, w: 8, h: 4, color: 0xc98f4a },
  { id: 'interior_zone_seating', name: 'Sitznischen', kind: 'LOUNGE', x: 2, y: 5, w: 8, h: 4, color: 0xb07a5a },
  { id: 'interior_zone_door', name: 'Eingang', kind: 'ENTRANCE', x: 4, y: 8, w: 4, h: 2, color: 0x94a3b8 },
]);

const SHOP_ZONES: readonly LayoutZone[] = Object.freeze([
  { id: 'interior_zone_counter', name: 'Verkaufstresen', kind: 'EXCHANGE', x: 2, y: 1, w: 8, h: 4, color: 0xd8b45a },
  { id: 'interior_zone_shelves', name: 'Regalreihe', kind: 'STORAGE', x: 2, y: 5, w: 8, h: 4, color: 0x9aa0a6 },
  { id: 'interior_zone_door', name: 'Eingang', kind: 'ENTRANCE', x: 4, y: 8, w: 4, h: 2, color: 0x94a3b8 },
]);

const DEFS: readonly InteriorDef[] = Object.freeze([
  Object.freeze({
    kind: 'PUB' as const,
    buildingId: 'bld_kiez_pub',
    layoutId: 'layout_kiez_pub',
    name: 'Kiezkneipe Zum Anker',
    layout: layout('WOOD', PUB_ZONES),
    furniture: Object.freeze([
      furniture(41001, 'BAR', 3, 2, 5, 1, 'Theke', 'interior_zone_bar', 4, 6),
      furniture(41002, 'TABLE', 3, 6, 2, 2, 'Tisch', 'interior_zone_seating', 4),
      furniture(41003, 'DECOR', 8, 6, 1, 1, 'Pflanze', 'interior_zone_seating'),
      furniture(41004, 'DECOR', 8, 2, 1, 1, 'Schild', 'interior_zone_bar'),
    ]),
    spawn: Object.freeze({ x: DOOR_X, y: 7 }),
    exitTile: Object.freeze({ x: DOOR_X, y: 9 }),
    streetDoor: Object.freeze({ x: 24, y: 14 }),
  }),
  Object.freeze({
    kind: 'SHOP' as const,
    buildingId: 'bld_corner_shop',
    layoutId: 'layout_corner_shop',
    name: 'Späti 24 / Kiez-Laden',
    layout: layout('TILE', SHOP_ZONES),
    furniture: Object.freeze([
      furniture(42001, 'DECOR', 3, 2, 5, 1, 'Theke', 'interior_zone_counter'),
      furniture(42002, 'STORAGE', 3, 6, 2, 2, 'Lagerregal', 'interior_zone_shelves'),
      furniture(42003, 'DECOR', 8, 6, 1, 1, 'Pflanze', 'interior_zone_shelves'),
      furniture(42004, 'DECOR', 8, 2, 1, 1, 'Schild', 'interior_zone_counter'),
    ]),
    spawn: Object.freeze({ x: DOOR_X, y: 7 }),
    exitTile: Object.freeze({ x: DOOR_X, y: 9 }),
    streetDoor: Object.freeze({ x: 39, y: 12 }),
  }),
]);

const BY_LAYOUT = new Map(DEFS.map((def) => [def.layoutId, def] as const));

/** Innenraum zu einer Gebäude-Layout-ID; unbekannte IDs bleiben wirkungslos. */
export function interiorDef(layoutId: string | undefined): InteriorDef | null {
  return layoutId ? BY_LAYOUT.get(layoutId) ?? null : null;
}

/** Alle definierten Innenräume; eine Liste für Abnahme und Tests. */
export function interiorLayouts(): readonly InteriorDef[] {
  return DEFS;
}
