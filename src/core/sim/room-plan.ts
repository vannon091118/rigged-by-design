/**
 * Raumplan aus dem Layout: Zonen sind Raeume, Kanten sind ihre Zugaenge.
 *
 * Der Plan ist eine Ableitung, kein zweiter Zustand. Er liest die vorhandene
 * Layout-Wahrheit (`zones` und `edges`), zaehlt Tueren und Durchgaenge am
 * Raumrand und rechnet die geplante Gaestekapazitaet aus der Flaeche je
 * Nutzung. Ein weiteres Geschoss waere ein eigener LayoutState mit derselben
 * Ableitung - kein neues Save-Feld und keine zweite Raumliste.
 */
import { navGrid } from './nav-grid';
import { reachableTiles } from './nav-reach';
import type { LayoutEdge, LayoutState, LayoutZone, ZoneKind } from './layout-types';
import type { Point } from './types';

/** Planungswert: ein Gast je so vielen Tiles, je nach Raumfunktion. */
const TILES_PER_GUEST: Readonly<Record<ZoneKind, number>> = {
  ENTRANCE: 2,
  EXCHANGE: 4,
  GAMING: 3,
  BAR: 2,
  TOILET: 4,
  STORAGE: 0,
  LOUNGE: 3,
  EXPANSION: 4,
};

/** Ein Raum mit Funktion, Flaeche, Zugaengen und geplanter Kapazitaet. */
export interface RoomPlan {
  readonly id: string;
  readonly name: string;
  /** Raumfunktion; dieselbe `ZoneKind`, die schon den Boden bestimmt. */
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tiles: number;
  /** Tueren und Durchgaenge, die direkt an den Raum grenzen. */
  readonly accesses: number;
  /** Mindestens eine Kachel ist vom Eingang aus ueber offene Kanten erreichbar. */
  readonly reachable: boolean;
  /** Geplante Gaesteplaetze; Lager ist kein Gastraum und bleibt bei 0. */
  readonly guestCapacity: number;
}

interface RoomPlanSummary {
  readonly rooms: number;
  readonly reachable: number;
  readonly guestCapacity: number;
  /** Namen der Raeume ohne erreichbare Kachel; leer heisst: alle haben Zugang. */
  readonly withoutAccess: readonly string[];
}

const inside = (zone: LayoutZone, x: number, y: number): boolean =>
  x >= zone.x && y >= zone.y && x < zone.x + zone.w && y < zone.y + zone.h;

const inBounds = (layout: LayoutState, point: Point): boolean =>
  point.x >= 0 && point.y >= 0 && point.x < layout.size && point.y < layout.size;

/** Beide anliegenden Kacheln einer Kante, soweit sie im Raster liegen. */
function adjacentTiles(layout: LayoutState, edge: LayoutEdge): readonly Point[] {
  const pair: Point[] = edge.axis === 'H'
    ? [{ x: edge.x, y: edge.y - 1 }, { x: edge.x, y: edge.y }]
    : [{ x: edge.x - 1, y: edge.y }, { x: edge.x, y: edge.y }];
  return pair.filter((point) => inBounds(layout, point));
}

/**
 * Innenkachel der Eingangstuer: die Tuer, die eine ENTRANCE-Zone traegt,
 * sonst die erste Tuer. Ohne Tuer hat kein Raum einen belegten Zugang.
 */
function entranceTile(layout: LayoutState): Point | null {
  const entranceZones = new Set(layout.zones.filter((zone) => zone.kind === 'ENTRANCE').map((zone) => zone.id));
  const doors = layout.edges.filter((edge) => edge.kind === 'DOOR');
  const door = doors.find((edge) => edge.zoneId !== null && entranceZones.has(edge.zoneId)) ?? doors[0];
  if (!door) return null;
  const tiles = adjacentTiles(layout, door);
  return tiles.find((point) => layout.zones.some((zone) => zone.kind === 'ENTRANCE' && inside(zone, point.x, point.y)))
    ?? tiles[0]
    ?? null;
}

function capacityFor(kind: ZoneKind, tiles: number): number {
  const perGuest = TILES_PER_GUEST[kind];
  if (perGuest === 0) return 0;
  return Math.max(1, Math.floor(tiles / perGuest));
}

/**
 * Ein Plan je Zone, in Layout-Reihenfolge. Die Erreichbarkeit wird einmal vom
 * Eingang aus ueber offene Kanten bestimmt; Moebel spielen fuer den Zugang
 * eines Raums keine Rolle, sie stehen in ihm.
 */
export function roomPlans(layout: LayoutState): readonly RoomPlan[] {
  const start = entranceTile(layout);
  const reached = start ? reachableTiles(navGrid(layout.size, [], layout), start) : new Set<number>();
  return layout.zones.map((zone) => {
    const tiles = zone.w * zone.h;
    const accesses = layout.edges.filter((edge) => edge.kind !== 'WALL'
      && adjacentTiles(layout, edge).some((point) => inside(zone, point.x, point.y))).length;
    let reachable = false;
    for (let y = zone.y; y < zone.y + zone.h && !reachable; y += 1) {
      for (let x = zone.x; x < zone.x + zone.w; x += 1) {
        if (reached.has(y * layout.size + x)) {
          reachable = true;
          break;
        }
      }
    }
    return {
      id: zone.id,
      name: zone.name,
      kind: zone.kind,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      tiles,
      accesses,
      reachable,
      guestCapacity: capacityFor(zone.kind, tiles),
    };
  });
}

/** Zahlen fuer den Kopf des Editors; rechnet nur ueber den vorhandenen Plan. */
export function roomPlanSummary(plans: readonly RoomPlan[]): RoomPlanSummary {
  return {
    rooms: plans.length,
    reachable: plans.filter((room) => room.reachable).length,
    guestCapacity: plans.reduce((sum, room) => sum + room.guestCapacity, 0),
    withoutAccess: plans.filter((room) => !room.reachable).map((room) => room.name),
  };
}
