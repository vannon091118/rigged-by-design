/**
 * Physisches Außenwelt-Layout und Straßen-Infrastruktur der Nachbarschaft.
 *
 * Die Stadt ist kein statisches Menü: Straßen, Gehwege, Kreuzungen und
 * Gebäudeeingänge bilden den zusammenhängenden Spielraum.
 */
import { CITY_PRESET_BUILDINGS } from './building';
import type { BuildingState } from './building-types';
import { CITY_GRID_SIZE, CITY_ROAD_RECTS } from './city-roads';
import type { EdgeAxis, FloorMaterialId, LayoutEdge, LayoutState, LayoutZone } from './layout-types';
import type { Point } from './types-model';

export type PropKind = 'STREET_LIGHT' | 'BENCH' | 'TRASH_BIN' | 'BUS_STOP' | 'TREE';

/** Belegte Flaeche in Kacheln, vom Anker `position` nach rechts/unten. */
interface PropFootprint {
  readonly w: number;
  readonly h: number;
}

export interface StreetProp {
  readonly id: string;
  readonly kind: PropKind;
  readonly position: Point;
  readonly footprint: PropFootprint;
  readonly label: string;
}

/**
 * Der Fussabdruck folgt der sichtbaren Form: Die Bank ist breiter als die
 * uebrigen Requisiten, alles andere steht auf einer Kachel.
 */
export const STREET_PROP_FOOTPRINTS: Readonly<Record<PropKind, PropFootprint>> = Object.freeze({
  STREET_LIGHT: Object.freeze({ w: 1, h: 1 }),
  BENCH: Object.freeze({ w: 2, h: 1 }),
  TRASH_BIN: Object.freeze({ w: 1, h: 1 }),
  BUS_STOP: Object.freeze({ w: 1, h: 1 }),
  TREE: Object.freeze({ w: 1, h: 1 }),
});

export interface CityExteriorModel {
  readonly layoutId: string;
  readonly name: string;
  readonly layout: LayoutState;
  readonly buildings: readonly BuildingState[];
  readonly props: readonly StreetProp[];
  readonly playerApartmentStreetSpawn: Point;
}

const wallEdge = (axis: EdgeAxis, x: number, y: number): LayoutEdge => ({ axis, x, y, kind: 'WALL', id: null, zoneId: null });

/**
 * Grundrisskanten als Waende. Das Navigationsraster kennt nur Kanten und
 * Moebel; ohne diese Kanten waeren die gezeichneten Fassaden nur Bild und die
 * Figur liefe mitten durch das Haus. Genau die Eingangskante bleibt offen und
 * ist die eine Tuer des Gebaeudes.
 */
export function cityBuildingWalls(buildings: readonly BuildingState[]): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  for (const building of buildings) {
    const { x, y, w, h } = building.footprint;
    const door = building.entrance;
    const doorOnH = door.y === y || door.y === y + h;
    for (let tx = x; tx < x + w; tx += 1) {
      if (!(doorOnH && door.x === tx && door.y === y)) edges.push(wallEdge('H', tx, y));
      if (!(doorOnH && door.x === tx && door.y === y + h)) edges.push(wallEdge('H', tx, y + h));
    }
    for (let ty = y; ty < y + h; ty += 1) {
      const doorOnV = !doorOnH && door.y === ty;
      if (!(doorOnV && door.x === x)) edges.push(wallEdge('V', x, ty));
      if (!(doorOnV && door.x === x + w)) edges.push(wallEdge('V', x + w, ty));
    }
  }
  return edges;
}

/** Erzeugt das kanonische Straßen-Layout des Stadtviertels (60x60 Raster). */
export function createCityStreetLayout(): LayoutState {
  const size = CITY_GRID_SIZE;
  const totalTiles = size * size;
  const floor: FloorMaterialId[] = new Array<FloorMaterialId>(totalTiles).fill('STONE');

  // Fahrbahnen kommen aus der Maske; der Boden malt sie nur. Damit prueft das
  // Grundstuecksregister dieselbe Geometrie, die der Spieler sieht, auch nach
  // der Gebaeudebemalung weiter unten.
  for (const road of CITY_ROAD_RECTS) {
    for (let y = road.y; y < road.y + road.h; y += 1) {
      for (let x = road.x; x < road.x + road.w; x += 1) floor[y * size + x] = 'CONCRETE';
    }
  }

  // Gebäudegrundflächen und Eingänge
  for (const bld of CITY_PRESET_BUILDINGS) {
    const { x: bx, y: by, w: bw, h: bh } = bld.footprint;
    for (let y = by; y < by + bh; y += 1) {
      for (let x = bx; x < bx + bw; x += 1) {
        if (x < size && y < size) floor[y * size + x] = 'WOOD';
      }
    }
    const eIdx = bld.entrance.y * size + bld.entrance.x;
    if (eIdx >= 0 && eIdx < totalTiles) floor[eIdx] = 'TILE';
  }

  const zones: LayoutZone[] = [
    { id: 'ext_zone_north_sidewalk', name: 'Nördlicher Gehweg', kind: 'LOUNGE', x: 2, y: 11, w: 56, h: 3, color: 0x94a3b8 },
    { id: 'ext_zone_main_street', name: 'Kiez-Hauptstraße', kind: 'EXPANSION', x: 0, y: 14, w: 60, h: 5, color: 0x475569 },
    { id: 'ext_zone_south_sidewalk', name: 'Südlicher Gehweg', kind: 'LOUNGE', x: 2, y: 19, w: 56, h: 3, color: 0x94a3b8 },
    { id: 'ext_zone_casino_plaza', name: 'Casino-Vorplatz', kind: 'ENTRANCE', x: 18, y: 20, w: 12, h: 4, color: 0xf59e0b },
  ];

  const doors: LayoutEdge[] = [
    { axis: 'H', x: 8, y: 12, kind: 'DOOR', id: 'door_street_to_player_apt', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 24, y: 14, kind: 'DOOR', id: 'door_street_to_kiez_pub', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 39, y: 12, kind: 'DOOR', id: 'door_street_to_corner_shop', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 22, y: 22, kind: 'DOOR', id: 'door_street_to_casino_grand', zoneId: 'ext_zone_casino_plaza' },
  ];
  const edges: readonly LayoutEdge[] = [...cityBuildingWalls(CITY_PRESET_BUILDINGS), ...doors];

  return Object.freeze({ size, floor: Object.freeze(floor), zones: Object.freeze(zones), edges: Object.freeze(edges) });
}

const STREET_PROPS_RAW: readonly [string, PropKind, number, number, string][] = [
  ['prop_lamp_apt', 'STREET_LIGHT', 7, 13, 'Straßenlaterne vor dem Wohnhaus'],
  ['prop_bench_pub', 'BENCH', 16, 13, 'Kneipenbank draußen'],
  ['prop_trash_shop', 'TRASH_BIN', 38, 13, 'Mülleimer am Späti'],
  ['prop_bus_stop', 'BUS_STOP', 26, 19, 'Bushaltestelle Kiez-Mitte'],
  ['prop_tree_plaza', 'TREE', 14, 20, 'Alte Platane am Casino-Vorplatz'],
];

/** Erzeugt das vollständige Außenwelt-Modell des Stadtviertels. */
export function createCityExteriorModel(): CityExteriorModel {
  const layout = createCityStreetLayout();
  const props = STREET_PROPS_RAW.map(([id, kind, x, y, label]) =>
    Object.freeze({
      id,
      kind,
      position: Object.freeze({ x, y }),
      footprint: STREET_PROP_FOOTPRINTS[kind],
      label,
    }),
  );

  return Object.freeze({
    layoutId: 'layout_city_street_quarter',
    name: 'Kiez-Viertel Hauptstraße',
    layout,
    buildings: CITY_PRESET_BUILDINGS,
    props: Object.freeze(props),
    playerApartmentStreetSpawn: Object.freeze({ x: 8, y: 13 }),
  });
}

/** Alle Kacheln, die eine Requisite belegt; Navigation und Test lesen dieselbe Liste. */
export function streetPropFootprintTiles(prop: StreetProp): Point[] {
  const tiles: Point[] = [];
  for (let y = prop.position.y; y < prop.position.y + prop.footprint.h; y += 1) {
    for (let x = prop.position.x; x < prop.position.x + prop.footprint.w; x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}
