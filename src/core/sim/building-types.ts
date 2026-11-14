/**
 * Kanonische Typen für physische Gebäude in der Living World Engine.
 *
 * Jedes Gebäude ist ein physischer Ort in der Stadt mit fester Grundfläche,
 * Eingang, Öffnungszeiten, Eigentümer/Bewohnern und verknüpftem Innenraum-Layout.
 * Reine Datenstrukturen ohne Seiteneffekte (deterministisch, serialisierbar).
 */
import type { Point } from './types-model';

/** Art des Gebäudes; bestimmt Zugangsregeln und Zweck in der Simulation. */
export type BuildingKind =
  | 'APARTMENT'
  | 'RESIDENCE'
  | 'PUB'
  | 'SHOP'
  | 'CASINO'
  | 'OFFICE'
  | 'WORKSHOP';

/** Öffnungszeiten im 24h-Format (Stunden von 0 bis 23). */
export interface OperatingHours {
  /** Erste geöffnete Stunde (inklusive, 0-23). */
  readonly openHour: number;
  /** Schließstunde (exklusive, 0-24; 24 bedeutet bis Mitternacht geöffnet). */
  readonly closeHour: number;
}

/** Bauzustand: Rohbau (versiegelt, keine Stellen) oder fertig und zugänglich. */
export type ConstructionState = 'SHELL' | 'OPEN';

/** Rechteckige Grundfläche eines Gebäudes auf dem Außenwelt-Raster. */
export interface BuildingFootprint {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Zustand eines registrierten Gebäudes in der Stadt. */
export interface BuildingState {
  /** Eindeutige, stabile Kennung (z.B. 'bld_player_home', 'bld_kiez_pub'). */
  readonly id: string;
  /** Anzeigename im Spiel (z.B. 'Wohnung des Spielers', 'Kiezkneipe Zum Anker'). */
  readonly name: string;
  /** Kategorie des Gebäudes. */
  readonly kind: BuildingKind;
  /** Räumliche Ausdehnung auf der Straßenkarte. */
  readonly footprint: BuildingFootprint;
  /** Eingangstür / Treffpunkt auf der Straßenkarte. */
  readonly entrance: Point;
  /** ID des zugeordneten Innenraum-Layouts. */
  readonly interiorLayoutId: string;
  /** Eigentümer (NPC-ID, 'PLAYER' oder undefined). */
  readonly ownerId?: string;
  /** Feste Mieter oder Bewohner dieses Gebäudes. */
  readonly tenantIds: readonly string[];
  /** Reguläre Öffnungszeiten (undefined = privat oder rund um die Uhr). */
  readonly operatingHours?: OperatingHours;
  /** Ob das Gebäude aktuell verschlossen ist (z.B. nachts oder bei Privathaushalten). */
  readonly locked: boolean;
  /** Aktuelle Anzahl der im Innenraum anwesenden Personen (LOD-Zähler). */
  readonly occupancy: number;
  /** Bauzustand; fehlt in alten Saves und gilt dann als fertig. */
  readonly construction?: ConstructionState;
  /** Tag der Errichtung; ein Rohbau wird am Folgetag fertiggestellt. */
  readonly builtDay?: number;
}

/** Parameter zur Erstellung eines neuen Gebäudes. */
export interface CreateBuildingParams {
  readonly id: string;
  readonly name: string;
  readonly kind: BuildingKind;
  readonly footprint: BuildingFootprint;
  readonly entrance: Point;
  readonly interiorLayoutId: string;
  readonly ownerId?: string;
  readonly tenantIds?: readonly string[];
  readonly operatingHours?: OperatingHours;
  readonly locked?: boolean;
  readonly construction?: ConstructionState;
  readonly builtDay?: number;
}
