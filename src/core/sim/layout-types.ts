/**
 * Kanonischer Layout-Vertrag: Dimension, Bodenmaterial pro Tile, semantische
 * Zonen und Wandkanten. Reine Daten, keine Ableitung und kein Rendering.
 *
 * Drei getrennte Aussagen, die nie ineinander fallen:
 * - `ZoneKind` = spielerische Bedeutung eines Bereichs,
 * - `FloorMaterialId` = Bodenoptik je Tile,
 * - `LayoutEdge` = raeumliche Struktur (Wand, Tuer, Durchgang).
 */

/** Spielerische Bedeutung. Die Bodenoptik steht getrennt im `floor`-Feld. */
export const ZONE_KINDS = [
  'ENTRANCE', 'EXCHANGE', 'GAMING', 'BAR', 'TOILET', 'STORAGE', 'LOUNGE', 'EXPANSION',
] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

/** Erlaubte Bodenmaterialien; jeder Wert ist eine stabile ID, keine Farbe. */
export const FLOOR_MATERIALS = ['CONCRETE', 'STONE', 'LINOLEUM', 'CARPET', 'WOOD', 'TILE'] as const;
export type FloorMaterialId = (typeof FLOOR_MATERIALS)[number];

/** Erlaubte Floor-Kantenlaengen in Tiles; das Raster ist quadratisch. */
export const LAYOUT_SIZES = [30, 60, 90] as const;

/**
 * Semantischer Bereich. Das Rechteck ist die kanonische Zonenwahrheit; die
 * Bodenmaterialien liegen separat in `floor` und werden nicht dupliziert.
 */
export interface LayoutZone {
  readonly id: string;
  readonly name: string;
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Nur Darstellung: die abgeleitete Legacy-Zone erbt den Wert unveraendert. */
  readonly color: number;
}

/**
 * Kante im Raster, eindeutig verankert:
 * - `H` ist die Kante zwischen (x, y-1) und (x, y), y von 0 bis size,
 * - `V` ist die Kante zwischen (x-1, y) und (x, y), x von 0 bis size.
 * Jede Rasterkante hat damit genau eine Koordinate und genau einen Zustand.
 */
export type EdgeAxis = 'H' | 'V';
export type EdgeKind = 'WALL' | 'DOOR' | 'OPENING';

export interface LayoutEdge {
  readonly axis: EdgeAxis;
  readonly x: number;
  readonly y: number;
  readonly kind: EdgeKind;
  /** Stabile ID nur fuer Tueren und Durchgaenge; Waende tragen null. */
  readonly id: string | null;
  /** Referenz auf eine semantische Zone oder null. */
  readonly zoneId: string | null;
}

/** Die eine raeumliche Wahrheit einer Welt. `WorldState.size/zones` sind daraus abgeleitet. */
export interface LayoutState {
  readonly size: number;
  /** Genau `size * size` Eintraege, zeilenweise; ein Material pro Tile. */
  readonly floor: readonly FloorMaterialId[];
  readonly zones: readonly LayoutZone[];
  /** Hoechstens eine Kante je Koordinate; `kind` ist ihr einziger Zustand. */
  readonly edges: readonly LayoutEdge[];
}
