/**
 * Kanonisches Layout und Einrichtungs-Modell der Spieler-Wohnung.
 *
 * Der Spieler startet nicht im Casino, sondern in seiner eigenen Wohnung:
 * Aufwachen im Schlafbereich, Kochnische, Bad, Wohnbereich und Flur mit Haustür.
 */
import type { FloorMaterialId, LayoutEdge, LayoutState, LayoutZone } from './layout-types';
import type { Point } from './types-model';

export type ApartmentFurnitureKind =
  | 'BED' | 'WARDROBE' | 'SOFA' | 'TABLE' | 'KITCHEN_COUNTER' | 'FRIDGE' | 'TOILET' | 'SINK' | 'SMARTPHONE';

export interface ApartmentFurnitureItem {
  readonly id: string;
  readonly name: string;
  readonly kind: ApartmentFurnitureKind;
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

/** Erzeugt das kanonische Layout der Spieler-Wohnung (30x30 Raster). */
export function createPlayerApartmentLayout(): LayoutState {
  const size = 30;
  const floor: FloorMaterialId[] = new Array<FloorMaterialId>(size * size).fill('CONCRETE');

  for (let y = 5; y < 25; y += 1) {
    for (let x = 5; x < 25; x += 1) {
      const idx = y * size + x;
      if (x < 15 && y < 15) floor[idx] = 'CARPET';
      else if (x >= 15 && y < 15) floor[idx] = 'WOOD';
      else if (x < 14 && y >= 15) floor[idx] = 'TILE';
      else if (x >= 14 && x < 20 && y >= 15) floor[idx] = 'LINOLEUM';
      else floor[idx] = 'STONE';
    }
  }

  const zones: LayoutZone[] = [
    { id: 'apt_zone_bedroom', name: 'Schlafzimmer', kind: 'LOUNGE', x: 5, y: 5, w: 10, h: 10, color: 0x3b82f6 },
    { id: 'apt_zone_living', name: 'Wohnbereich', kind: 'LOUNGE', x: 15, y: 5, w: 10, h: 10, color: 0x10b981 },
    { id: 'apt_zone_bathroom', name: 'Badezimmer', kind: 'TOILET', x: 5, y: 15, w: 9, h: 10, color: 0x06b6d4 },
    { id: 'apt_zone_kitchen', name: 'Kochnische', kind: 'BAR', x: 14, y: 15, w: 6, h: 10, color: 0xf59e0b },
    { id: 'apt_zone_hallway', name: 'Wohnungsflur', kind: 'ENTRANCE', x: 20, y: 15, w: 5, h: 10, color: 0x8b5cf6 },
  ];

  const edges: LayoutEdge[] = [
    { axis: 'H', x: 22, y: 25, kind: 'DOOR', id: 'door_apt_exit_to_street', zoneId: 'apt_zone_hallway' },
    { axis: 'V', x: 15, y: 10, kind: 'OPENING', id: 'opening_apt_bed_living', zoneId: 'apt_zone_bedroom' },
    { axis: 'H', x: 9, y: 15, kind: 'DOOR', id: 'door_apt_bathroom', zoneId: 'apt_zone_bathroom' },
  ];

  return Object.freeze({ size, floor: Object.freeze(floor), zones: Object.freeze(zones), edges: Object.freeze(edges) });
}

const APARTMENT_FURNITURE_RAW: readonly [string, string, ApartmentFurnitureKind, number, number, boolean, string][] = [
  ['furn_player_bed', 'Eigenes Bett', 'BED', 7, 7, true, 'Hier erwachst du zu Beginn eines jeden neuen Tages.'],
  ['furn_player_wardrobe', 'Kleiderschrank', 'WARDROBE', 12, 6, true, 'Zum Wechseln von Kleidung und Habseligkeiten.'],
  ['furn_player_smartphone', 'Smartphone', 'SMARTPHONE', 9, 7, true, 'Nachrichten, Kontakte und Benachrichtigungen.'],
  ['furn_player_sofa', 'Sofa', 'SOFA', 18, 8, true, 'Bequemer Platz zum Ausruhen und Nachdenken.'],
  ['furn_player_table', 'Wohnzimmertisch', 'TABLE', 20, 8, false, 'Ein einfacher Holztisch mit Notizen.'],
  ['furn_player_fridge', 'Kühlschrank', 'FRIDGE', 15, 16, true, 'Kühle Getränke und Vorräte gegen Hunger und Durst.'],
  ['furn_player_kitchen_counter', 'Kochnische mit Spüle', 'KITCHEN_COUNTER', 17, 16, true, 'Einfache Küchenzeile.'],
  ['furn_player_toilet', 'Toilette', 'TOILET', 7, 22, true, 'Badezimmer-Ausstattung.'],
  ['furn_player_sink', 'Waschbecken & Spiegel', 'SINK', 11, 22, true, 'Morgendliche Frische vor dem Hinaustreten.'],
];

/** Erzeugt das vollständige Modell der Spieler-Wohnung inklusive Möbel und Spawnpunkt. */
export function createPlayerApartmentModel(): PlayerApartmentModel {
  const layout = createPlayerApartmentLayout();
  const furniture = APARTMENT_FURNITURE_RAW.map(([id, name, kind, x, y, interactive, description]) =>
    Object.freeze({ id, name, kind, position: Object.freeze({ x, y }), interactive, description }),
  );

  return Object.freeze({
    layoutId: 'layout_player_apartment',
    name: 'Wohnung des Spielers',
    layout,
    exitDoor: Object.freeze({ x: 22, y: 25 }),
    bedSpawn: Object.freeze({ x: 8, y: 8 }),
    furniture: Object.freeze(furniture),
  });
}
