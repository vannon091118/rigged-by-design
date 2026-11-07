/** Ableitungen aus dem Layout-Vertrag: Vorlage, Boden, Legacy-Sicht und Ausbau. */
import { edgeInBounds, edgeKey, edgeOnRim, freezeLayout } from './layout-edges';
import { BLUEPRINTS } from './house-presets';
import type { EdgeAxis, FloorMaterialId, LayoutEdge, LayoutState, LayoutZone, ZoneKind } from './layout-types';
import type { TemplateId, Zone } from './types-model';

/** Spielbedeutung bestimmt die Bodenoptik, nie umgekehrt. */
const MATERIAL_BY_KIND: Readonly<Record<ZoneKind, FloorMaterialId>> = {
  ENTRANCE: 'STONE',
  EXCHANGE: 'LINOLEUM',
  GAMING: 'CARPET',
  BAR: 'WOOD',
  TOILET: 'TILE',
  STORAGE: 'CONCRETE',
  LOUNGE: 'CARPET',
  EXPANSION: 'CONCRETE',
};

/** Legacy-Sicht: dieselben Zonen als Rechtecke, in unveraenderter Reihenfolge. */
export function zonesFromLayout(layout: LayoutState): Zone[] {
  return layout.zones.map((zone) => ({ ...zone }));
}

export function floorMaterialAt(layout: LayoutState, x: number, y: number): FloorMaterialId | null {
  if (x < 0 || y < 0 || x >= layout.size || y >= layout.size) return null;
  return layout.floor[y * layout.size + x] ?? null;
}

/** Jede Tuer und jeder Durchgang; Waende sind der stille Rest. */
export function doorsOfLayout(layout: LayoutState): readonly LayoutEdge[] {
  return layout.edges.filter((edge) => edge.kind !== 'WALL');
}

/** Ein Material pro Tile; die Zone liefert die Optik, nicht die Geometrie. */
function fillFloor(size: number, zones: readonly LayoutZone[]): FloorMaterialId[] {
  const floor: FloorMaterialId[] = new Array(size * size).fill('CONCRETE');
  for (const zone of zones) {
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
      for (let x = zone.x; x < zone.x + zone.w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) floor[y * size + x] = MATERIAL_BY_KIND[zone.kind];
      }
    }
  }
  return floor;
}

/** Alle vier Randkanten als Wand; eine Tuer ersetzt spaeter genau eine davon. */
function rimWalls(size: number): LayoutEdge[] {
  const walls: LayoutEdge[] = [];
  const wall = (axis: EdgeAxis, x: number, y: number): LayoutEdge => ({ axis, x, y, kind: 'WALL', id: null, zoneId: null });
  for (let x = 0; x < size; x += 1) walls.push(wall('H', x, 0), wall('H', x, size));
  for (let y = 0; y < size; y += 1) walls.push(wall('V', 0, y), wall('V', size, y));
  return walls;
}

/** Eingangstuer auf genau der Kante, auf der `doorPoint()` den Gast absetzt. */
function entranceDoor(zone: LayoutZone): LayoutEdge {
  return {
    axis: 'V', x: Math.max(0, zone.x - 1), y: zone.y + Math.floor(zone.h / 2),
    kind: 'DOOR', id: `door-${zone.id}`, zoneId: zone.id,
  };
}

/**
 * Kantenliste aus Randwaenden, uebernommenen Kanten und Eingangstuer. Vorrang:
 * Wand < uebernommene Kante < Tuer; eine Kante steht damit genau einmal drin.
 */
function edgesFor(zones: readonly LayoutZone[], size: number, kept: readonly LayoutEdge[]): LayoutEdge[] {
  const byKey = new Map<string, LayoutEdge>();
  for (const edge of rimWalls(size)) byKey.set(edgeKey(edge.axis, edge.x, edge.y), edge);
  for (const edge of kept) {
    if (edgeInBounds(edge.axis, edge.x, edge.y, size)) byKey.set(edgeKey(edge.axis, edge.x, edge.y), edge);
  }
  if (![...byKey.values()].some((edge) => edge.kind === 'DOOR')) {
    const entrance = zones.find((zone) => zone.kind === 'ENTRANCE');
    if (entrance) {
      const door = entranceDoor(entrance);
      byKey.set(edgeKey(door.axis, door.x, door.y), door);
    }
  }
  return [...byKey.values()];
}

/** Deterministischer Plan aus der Vorlage; die einzige Quelle fuer neue Welten. */
export function layoutFromTemplate(template: TemplateId): LayoutState {
  const blueprint = BLUEPRINTS[template];
  const zones: LayoutZone[] = blueprint.zones.map((zone) => ({ ...zone }));
  return freezeLayout(blueprint.size, fillFloor(blueprint.size, zones), zones, edgesFor(zones, blueprint.size, []));
}

/**
 * Ausbau: alte Tiles behalten ihren Boden an ihrer Koordinate, neue Flaechen
 * erben die Zone, und die alte Aussenwand verschwindet, damit kein zugemauerter
 * Altbau entsteht. Tueren und Innenkanten bleiben erhalten.
 */
export function layoutWithZones(layout: LayoutState, size: number, added: readonly LayoutZone[]): LayoutState {
  const zones = [...layout.zones, ...added.map((zone) => ({ ...zone }))];
  const floor: FloorMaterialId[] = new Array(size * size).fill('CONCRETE');
  for (let y = 0; y < layout.size && y < size; y += 1) {
    for (let x = 0; x < layout.size && x < size; x += 1) {
      floor[y * size + x] = layout.floor[y * layout.size + x]!;
    }
  }
  for (const zone of added) {
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
      for (let x = zone.x; x < zone.x + zone.w; x += 1) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        // Alter Boden bleibt unangetastet; nur neues Gebiet erbt die Zone.
        if (x < layout.size && y < layout.size) continue;
        floor[y * size + x] = MATERIAL_BY_KIND[zone.kind];
      }
    }
  }
  const kept = layout.edges.filter((edge) => edge.kind !== 'WALL' || !edgeOnRim(edge, layout.size));
  return freezeLayout(size, floor, zones, edgesFor(zones, size, kept));
}
