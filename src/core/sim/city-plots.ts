/**
 * @module city-plots — Grundstücksregister der Stadt
 *
 * Ein Grundstück ist ein fester Platz im Kartenlayout: Rechteck, Widmung und —
 * sobald bebaut — genau ein Gebäude. Der Register ist abgeleitet und statisch;
 * er steht nicht im Save, sondern folgt aus der Karte, deshalb bleiben alte
 * Saves ohne dieses Feld lesbar. Die Reserveplätze sind der Anker für Bau (S3):
 * gebaut wird nur auf einem eingetragenen Platz, nie auf einer Straße.
 */
import { CITY_PRESET_BUILDINGS } from './building';
import type { BuildingFootprint, BuildingState } from './building-types';
import { CITY_GRID_SIZE, roadTilesIn } from './city-roads';

/** Widmung eines Grundstücks; sie entscheidet, was darauf gebaut werden darf. */
type CityZoning = 'HOME' | 'BUSINESS' | 'PUBLIC';

export interface CityPlot {
  readonly id: string;
  readonly label: string;
  readonly rect: BuildingFootprint;
  readonly zoning: CityZoning;
}

/**
 * Die festen Plätze. Die ersten vier tragen die kuratierten Gebäude und haben
 * deren Grundfläche; die übrigen Reserve liegt weder auf Fahrbahn noch Gebäude.
 */
const PLOT_SITES: readonly CityPlot[] = Object.freeze([
  { id: 'plot_player_home', label: 'Wohnhaus am Nordgehweg', rect: { x: 4, y: 4, w: 10, h: 8 }, zoning: 'HOME' },
  { id: 'plot_kiez_pub', label: 'Eckgrundstück Kiez-Kneipe', rect: { x: 18, y: 4, w: 12, h: 8 }, zoning: 'BUSINESS' },
  { id: 'plot_corner_shop', label: 'Ladengrundstück am Späti', rect: { x: 34, y: 4, w: 10, h: 8 }, zoning: 'BUSINESS' },
  { id: 'plot_casino_grand', label: 'Casino am Vorplatz', rect: { x: 12, y: 22, w: 16, h: 14 }, zoning: 'BUSINESS' },
  { id: 'plot_reserve_north_west', label: 'Baulücke westlich des Wohnhauses', rect: { x: 0, y: 4, w: 4, h: 6 }, zoning: 'HOME' },
  { id: 'plot_reserve_north_gap', label: 'Baulücke zwischen Wohnhaus und Kneipe', rect: { x: 14, y: 4, w: 4, h: 6 }, zoning: 'HOME' },
  { id: 'plot_reserve_north_east', label: 'Freie Fläche östlich des Spätis', rect: { x: 44, y: 4, w: 14, h: 6 }, zoning: 'BUSINESS' },
  { id: 'plot_reserve_south_west', label: 'Freie Fläche westlich des Casinos', rect: { x: 2, y: 22, w: 8, h: 10 }, zoning: 'HOME' },
  { id: 'plot_reserve_south_east', label: 'Freie Fläche östlich des Casinos', rect: { x: 34, y: 22, w: 14, h: 12 }, zoning: 'BUSINESS' },
]);

/** Das Register; eine statische Tabelle, kein Weltzustand. */
export const CITY_PLOTS: readonly CityPlot[] = PLOT_SITES;

const sameRect = (a: BuildingFootprint, b: BuildingFootprint): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Das Grundstück, das genau diese Fläche trägt. */
export function plotAtRect(rect: BuildingFootprint): CityPlot | null {
  return CITY_PLOTS.find((plot) => sameRect(plot.rect, rect)) ?? null;
}

/** Der feste Platz des Gebäudes; ohne Eintrag steht das Gebäude nirgends. */
export function plotForBuilding(buildingId: string): CityPlot | null {
  const building = CITY_PRESET_BUILDINGS.find((entry) => entry.id === buildingId);
  return building ? plotAtRect(building.footprint) : null;
}

/** Das Grundstück an dieser Kachel, falls es eines gibt. */
export function plotAt(x: number, y: number): CityPlot | null {
  return CITY_PLOTS.find((plot) => x >= plot.rect.x && x < plot.rect.x + plot.rect.w
    && y >= plot.rect.y && y < plot.rect.y + plot.rect.h) ?? null;
}

/** Das Gebäude, das auf diesem Platz steht; Reservegrundstücke bleiben leer. */
export function buildingOnPlot(
  plotId: string, buildings: readonly BuildingState[] = CITY_PRESET_BUILDINGS,
): BuildingState | null {
  return buildings.find((building) => plotAtRect(building.footprint)?.id === plotId) ?? null;
}

/** Alle bebauten Plätze; die Reserve bleibt sichtbar, aber ohne Gebäude. */
export function builtPlots(
  buildings: readonly BuildingState[] = CITY_PRESET_BUILDINGS,
): readonly { readonly plot: CityPlot; readonly building: BuildingState }[] {
  return CITY_PLOTS.flatMap((plot) => {
    const building = buildings.find((entry) => sameRect(entry.footprint, plot.rect));
    return building ? [{ plot, building }] : [];
  });
}

type PlotIssueCode =
  | 'PLOT_OUT_OF_GRID' | 'PLOT_OVERLAP' | 'PLOT_ON_ROAD'
  | 'UNREGISTERED_BUILDING' | 'DOUBLE_OCCUPANCY';

interface PlotIssue {
  readonly code: PlotIssueCode;
  readonly plotId: string;
  readonly detail: string;
}

const tilesOf = (rect: BuildingFootprint): { x: number; y: number }[] => {
  const tiles: { x: number; y: number }[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) tiles.push({ x, y });
  }
  return tiles;
};

/**
 * Prüft den Register gegen die Karte: Plätze im Raster, keine Überlappung,
 * keine Fahrbahn unter einem Platz, jedes Gebäude auf genau einem Platz und
 * kein Platz doppelt bebaut. Leere Liste heisst: der Register stimmt.
 */
export function plotRegisterIssues(
  buildings: readonly BuildingState[] = CITY_PRESET_BUILDINGS,
): readonly PlotIssue[] {
  const issues: PlotIssue[] = [];
  const occupied = new Map<string, string>();
  for (const plot of CITY_PLOTS) {
    const { x, y, w, h } = plot.rect;
    if (x < 0 || y < 0 || x + w > CITY_GRID_SIZE || y + h > CITY_GRID_SIZE || w <= 0 || h <= 0) {
      issues.push({ code: 'PLOT_OUT_OF_GRID', plotId: plot.id, detail: `${w}x${h} bei ${x},${y}` });
      continue;
    }
    // Die Fahrbahnmaske statt des gemalten Bodens: Ein Gebaeude faerbt seine
    // Kacheln selbst zu WOOD, deshalb war die Pruefung gegen `floor` blind.
    const road = roadTilesIn(plot.rect)[0];
    if (road) {
      issues.push({ code: 'PLOT_ON_ROAD', plotId: plot.id, detail: `Fahrbahn bei ${road.x},${road.y}` });
    }
    for (const tile of tilesOf(plot.rect)) {
      const key = `${tile.x},${tile.y}`;
      const other = occupied.get(key);
      if (other && other !== plot.id) {
        issues.push({ code: 'PLOT_OVERLAP', plotId: plot.id, detail: `überlappt ${other}` });
        break;
      }
      occupied.set(key, plot.id);
    }
  }
  for (const building of buildings) {
    const plot = plotAtRect(building.footprint);
    if (!plot) {
      issues.push({ code: 'UNREGISTERED_BUILDING', plotId: '-', detail: building.id });
      continue;
    }
    const twins = buildings.filter((entry) => sameRect(entry.footprint, building.footprint));
    if (twins.length > 1 && twins[0]!.id === building.id) {
      issues.push({ code: 'DOUBLE_OCCUPANCY', plotId: plot.id, detail: twins.map((t) => t.id).join(', ') });
    }
  }
  return issues;
}
