/**
 * @module apartment-walls — Innenwände der Spielerwohnung
 *
 * Die Zonen in `player-apartment` sind die Raumwahrheit; hier stehen nur die
 * Kanten, die diese Räume trennen. Jede Wand ist eine echte `WALL`-Kante und
 * blockiert damit Navigation und Figuren; Türen und Durchgänge bleiben offen.
 * Dieselben Kanten speisen die Occlusion-Schicht, es gibt keinen zweiten Plan.
 */
import type { EdgeAxis, LayoutEdge } from './layout-types';

interface WallSpec {
  readonly axis: EdgeAxis;
  readonly x: number;
  readonly y: number;
}

/** Zonen: Bad 3..6 / Küche 7..9 / Flur 10..12 unter y=8; Schlafen 3..7 / Wohnen 8..12 darüber. */
const WALLS: readonly WallSpec[] = [
  // Nord-Süd-Trennung Schlafzimmer ↔ Wohnbereich (Durchgang bei y=5).
  { axis: 'V', x: 8, y: 3 }, { axis: 'V', x: 8, y: 4 },
  { axis: 'V', x: 8, y: 6 }, { axis: 'V', x: 8, y: 7 },
  // Querwand y=8: Bad, Küche und Flur gegen die obere Etage (Tür bei x=4, Durchgang bei x=11).
  { axis: 'H', x: 3, y: 8 }, { axis: 'H', x: 5, y: 8 }, { axis: 'H', x: 6, y: 8 },
  { axis: 'H', x: 7, y: 8 }, { axis: 'H', x: 8, y: 8 }, { axis: 'H', x: 9, y: 8 },
  { axis: 'H', x: 10, y: 8 }, { axis: 'H', x: 12, y: 8 },
  // Bad ↔ Kochnische.
  { axis: 'V', x: 7, y: 8 }, { axis: 'V', x: 7, y: 9 }, { axis: 'V', x: 7, y: 10 },
  { axis: 'V', x: 7, y: 11 }, { axis: 'V', x: 7, y: 12 },
  // Kochnische ↔ Flur (Tür bei y=10).
  { axis: 'V', x: 10, y: 8 }, { axis: 'V', x: 10, y: 9 },
  { axis: 'V', x: 10, y: 11 }, { axis: 'V', x: 10, y: 12 },
];

const wall = (spec: WallSpec): LayoutEdge => ({
  axis: spec.axis, x: spec.x, y: spec.y, kind: 'WALL', id: null, zoneId: null,
});

/** Türen und Durchgänge bleiben genau die vorhandenen Übergänge. */
const OPENINGS: readonly LayoutEdge[] = [
  { axis: 'H', x: 11, y: 13, kind: 'DOOR', id: 'door_apt_exit_to_street', zoneId: 'apt_zone_hallway' },
  { axis: 'V', x: 8, y: 5, kind: 'OPENING', id: 'opening_apt_bed_living', zoneId: 'apt_zone_bedroom' },
  { axis: 'H', x: 4, y: 8, kind: 'DOOR', id: 'door_apt_bathroom', zoneId: 'apt_zone_bathroom' },
  // Zwei neue Durchgänge, damit Wohnen ↔ Flur und Flur ↔ Kochnische begehbar bleiben.
  { axis: 'H', x: 11, y: 8, kind: 'OPENING', id: 'opening_apt_living_hall', zoneId: 'apt_zone_living' },
  { axis: 'V', x: 10, y: 10, kind: 'DOOR', id: 'door_apt_kitchen', zoneId: 'apt_zone_kitchen' },
];

/** Kanonische, reproduzierbare Reihenfolge wie im Layout-Vertrag. */
export function apartmentEdges(): readonly LayoutEdge[] {
  return Object.freeze(
    [...OPENINGS, ...WALLS.map(wall)].sort((left, right) => {
      if (left.axis !== right.axis) return left.axis < right.axis ? -1 : 1;
      return left.y - right.y || left.x - right.x;
    }),
  );
}
