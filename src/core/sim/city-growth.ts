/**
 * @module city-growth — Bauträger und Stadtwachstum (S3)
 *
 * Die Stadt baut auf ein Signal: Ein Bewohner ohne Arbeitsslot heisst, es gibt zu
 * wenig Arbeit. Erst dann fragt der Bauträger sein Konto und bebaut den ersten
 * freien Platz aus dem Grundstücksregister — samt neuem Slot durch die Stelle.
 * Ohne geladene Stadtszene gibt es keine Adresse, also wird gewartet; ein Bau
 * pro Tag reicht, und der Tag im Wachstumszustand macht den Schritt idempotent.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { CITY_PRESET_BUILDINGS, createBuilding } from './building';
import type { BuildingState } from './building-types';
import { cityJobMarket, type CityJobMarket, type EmploymentCandidate } from './city-employment';
import { cityBuildingWalls } from './city-exterior';
import { CITY_PLOTS, plotAtRect, type CityPlot } from './city-plots';
import { EXTERNAL, EXTERNAL_WORK } from './money';
import type { WorldState } from './types';

/** Konto des Bauträgers; er ist ein Stadtakteur, kein Spielerteil. */
export const BUILDER_ACCOUNT = 'BAUTRAGER';
/** Startkapital, damit die Stadt überhaupt wachsen kann. */
export const BUILDER_START_CAPITAL = fromVC(6000);
/** Was ein Neubau kostet; der Betrag geht als Bauarbeit nach aussen. */
export const BUILD_COST = fromVC(1800);
export interface CityGrowthState {
  readonly lastBuildDay: number;
  readonly built: readonly string[];
}

interface CityGrowthView extends CityJobMarket {
  readonly capital: VaCoinMicro;
  readonly freePlots: number;
  readonly canBuild: boolean;
}

interface BuildReport {
  readonly building: BuildingState;
  readonly cost: VaCoinMicro;
  readonly plotId: string;
  readonly joblessBefore: number;
}

/** Die Gebäude, die es in dieser Stadt gibt: kuratiert plus gebaut. */
export function cityBuildings(world: WorldState): readonly BuildingState[] {
  return world.cityScene?.exterior.buildings ?? CITY_PRESET_BUILDINGS;
}

function ensureCityGrowth(world: WorldState): CityGrowthState {
  if (!world.cityGrowth) world.cityGrowth = { lastBuildDay: 0, built: [] };
  return world.cityGrowth;
}

/** Arbeitsmarkt: belegte und freie Stellen aus der Beschäftigungszuordnung. */
export function jobMarket(
  buildings: readonly BuildingState[],
  residents: readonly EmploymentCandidate[],
): CityJobMarket {
  return cityJobMarket(buildings, residents);
}

/** Der nächste freie Platz: erst Gewerbe, denn Arbeit ist das Signal. */
function freePlot(buildings: readonly BuildingState[]): CityPlot | null {
  const free = CITY_PLOTS.filter((plot) =>
    !buildings.some((building) => plotAtRect(building.footprint)?.id === plot.id));
  return free.find((plot) => plot.zoning !== 'HOME') ?? free[0] ?? null;
}

export function cityGrowthView(world: WorldState, ledger: Ledger): CityGrowthView {
  const buildings = cityBuildings(world);
  const market = jobMarket(buildings, world.cityLife?.residents ?? []);
  const capital = ledger.getBalance(BUILDER_ACCOUNT);
  const freePlots = CITY_PLOTS.filter((plot) => !buildings.some((b) => plotAtRect(b.footprint)?.id === plot.id)).length;
  return {
    ...market,
    capital,
    freePlots,
    canBuild: market.jobless > 0 && freePlots > 0 && capital >= BUILD_COST,
  };
}

/** Wohnfläche bleibt Wohnung, alles andere Geschäft. */
function buildingFor(plot: CityPlot, count: number): BuildingState {
  const home = plot.zoning === 'HOME';
  return createBuilding({
    id: `bld_grown_${count + 1}`,
    name: `${home ? 'Wohnhaus' : 'Neubau'} ${plot.label}`,
    kind: home ? 'RESIDENCE' : 'SHOP',
    footprint: plot.rect,
    entrance: { x: plot.rect.x + Math.floor(plot.rect.w / 2), y: plot.rect.y + plot.rect.h },
    interiorLayoutId: 'layout_grown_unit',
    operatingHours: home ? undefined : { openHour: 8, closeHour: 20 },
    locked: true,
  });
}

/** Grundfläche bekommt Wände, aber keine Tür: der Rohbau ist noch nicht begehbar. */
function placeBuilding(world: WorldState, building: BuildingState): void {
  const scene = world.cityScene;
  if (!scene) return;
  const sealed = { ...building, entrance: { x: -1, y: -1 } };
  const layout = scene.layout;
  world.cityScene = {
    ...scene,
    exterior: { ...scene.exterior, buildings: [...scene.exterior.buildings, building] },
    layout: { ...layout, edges: [...layout.edges, ...cityBuildingWalls([sealed])] },
    zones: [...scene.zones],
    furniture: scene.furniture,
  };
}

/** Höchstens ein Bau pro Tag, nur bei Joblosen, nur mit Platz und Kapital. */
export function advanceCityGrowth(world: WorldState, ledger: Ledger): BuildReport | null {
  const growth = ensureCityGrowth(world);
  if (!world.cityScene || world.day <= growth.lastBuildDay) return null;
  const buildings = cityBuildings(world);
  const market = jobMarket(buildings, world.cityLife?.residents ?? []);
  if (market.jobless <= 0) return null;
  const plot = freePlot(buildings);
  if (!plot) return null;
  // Startkapital gibt es genau einmal; wer es verbraucht, baut nicht mehr.
  if (ledger.getBalance(BUILDER_ACCOUNT) <= ZERO_VC && growth.built.length === 0) {
    ledger.transfer(EXTERNAL, BUILDER_ACCOUNT, BUILDER_START_CAPITAL, 'Bautraeger: Startkapital', world.tick);
  }
  if (ledger.getBalance(BUILDER_ACCOUNT) < BUILD_COST) return null;
  const building = buildingFor(plot, growth.built.length);
  ledger.transfer(BUILDER_ACCOUNT, EXTERNAL_WORK, BUILD_COST, `Bau: ${building.name}`, world.tick);
  placeBuilding(world, building);
  world.cityGrowth = { lastBuildDay: world.day, built: [...growth.built, building.id] };
  return { building, cost: BUILD_COST, plotId: plot.id, joblessBefore: market.jobless };
}
