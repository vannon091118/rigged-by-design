/**
 * Physisches Außenwelt-Layout und Straßen-Infrastruktur der Nachbarschaft.
 *
 * Die Stadt ist kein statisches Menü: Straßen, Gehwege, Kreuzungen und
 * Gebäudeeingänge bilden den zusammenhängenden Spielraum.
 */
import { CITY_PRESET_BUILDINGS } from './building';
import type { BuildingState } from './building-types';
import type { FloorMaterialId, LayoutEdge, LayoutState, LayoutZone } from './layout-types';
import type { Point } from './types-model';

export type PropKind = 'STREET_LIGHT' | 'BENCH' | 'TRASH_BIN' | 'BUS_STOP' | 'TREE';

export interface StreetProp {
  readonly id: string;
  readonly kind: PropKind;
  readonly position: Point;
  readonly label: string;
}

export interface CityExteriorModel {
  readonly layoutId: string;
  readonly name: string;
  readonly layout: LayoutState;
  readonly buildings: readonly BuildingState[];
  readonly props: readonly StreetProp[];
  readonly playerApartmentStreetSpawn: Point;
}

/** Erzeugt das kanonische Straßen-Layout des Stadtviertels (60x60 Raster). */
export function createCityStreetLayout(): LayoutState {
  const size = 60;
  const totalTiles = size * size;
  const floor: FloorMaterialId[] = new Array<FloorMaterialId>(totalTiles).fill('STONE');

  // Fahrbahnen: Ost-West (y=14..18) und Querstraße (x=28..32, y=14..49)
  for (let y = 14; y <= 18; y += 1) {
    for (let x = 0; x < size; x += 1) floor[y * size + x] = 'CONCRETE';
  }
  for (let y = 14; y < 50; y += 1) {
    for (let x = 28; x <= 32; x += 1) floor[y * size + x] = 'CONCRETE';
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

  const edges: LayoutEdge[] = [
    { axis: 'H', x: 8, y: 12, kind: 'DOOR', id: 'door_street_to_player_apt', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 24, y: 14, kind: 'DOOR', id: 'door_street_to_kiez_pub', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 39, y: 12, kind: 'DOOR', id: 'door_street_to_corner_shop', zoneId: 'ext_zone_north_sidewalk' },
    { axis: 'H', x: 22, y: 22, kind: 'DOOR', id: 'door_street_to_casino_grand', zoneId: 'ext_zone_casino_plaza' },
  ];

  return Object.freeze({ size, floor: Object.freeze(floor), zones: Object.freeze(zones), edges: Object.freeze(edges) });
}

const STREET_PROPS_RAW: readonly [string, PropKind, number, number, string][] = [
  ['prop_lamp_apt', 'STREET_LIGHT', 7, 13, 'Straßenlaterne vor dem Wohnhaus'],
  ['prop_bench_pub', 'BENCH', 20, 13, 'Kneipenbank draußen'],
  ['prop_trash_shop', 'TRASH_BIN', 38, 13, 'Mülleimer am Späti'],
  ['prop_bus_stop', 'BUS_STOP', 26, 19, 'Bushaltestelle Kiez-Mitte'],
  ['prop_tree_plaza', 'TREE', 14, 20, 'Alte Platane am Casino-Vorplatz'],
];

/** Erzeugt das vollständige Außenwelt-Modell des Stadtviertels. */
export function createCityExteriorModel(): CityExteriorModel {
  const layout = createCityStreetLayout();
  const props = STREET_PROPS_RAW.map(([id, kind, x, y, label]) =>
    Object.freeze({ id, kind, position: Object.freeze({ x, y }), label }),
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
