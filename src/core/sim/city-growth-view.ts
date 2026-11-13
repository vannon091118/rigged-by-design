/**
 * @module city-growth-view — anzeigbare Sicht auf das Stadtwachstum (S3)
 *
 * Snapshot und Stadtfenster lesen dieselbe Sicht: Arbeitsmarkt, Bauträger-Konto,
 * freie Grundstücke, Stillstandsgrund und der letzte Bau. Die Sicht legt keinen
 * Zustand an; ohne `cityGrowth` bleibt der letzte Bau leer (#526).
 */
import type { Ledger } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import type { CityJobMarket } from './city-employment';
import type { BuildingState } from './building-types';
import { BUILDER_ACCOUNT, BUILD_COST, cityBuildings, jobMarket, type CityGrowthState } from './city-growth';
import { CITY_PLOTS, plotAtRect } from './city-plots';
import type { WorldState } from './types';

/**
 * Warum gerade nicht gebaut wird; ein sichtbarer Endzustand statt Stille.
 * Fehlendes Kapital ist kein Grund mehr: diese Differenz traegt die Foerderung.
 */
export type CityGrowthBlock = 'READY' | 'NO_JOBLESS' | 'NO_PLOTS';

/** Der letzte Neubau als anzeigbarer Beleg; Kosten sind der feste Baukostenbetrag. */
interface CityGrowthLastBuild {
  readonly id: string;
  readonly name: string;
  readonly plotId: string;
  readonly plotLabel: string;
  readonly day: number;
  readonly cost: VaCoinMicro;
}

/** Eine Sicht auf Arbeitsmarkt, Bauträgerkonto und den letzten Bau. */
export interface CityGrowthView extends CityJobMarket {
  readonly capital: VaCoinMicro;
  readonly freePlots: number;
  readonly canBuild: boolean;
  readonly blockedReason: CityGrowthBlock;
  /** Anzahl der vom Bauträger errichteten Gebäude. */
  readonly built: number;
  readonly lastBuild: CityGrowthLastBuild | null;
}

/** Der letzte Bau, abgeleitet aus dem Wachstumszustand; ohne Zustand leer. */
function lastBuildOf(
  buildings: readonly BuildingState[],
  growth: CityGrowthState | undefined,
): CityGrowthLastBuild | null {
  const id = growth?.built[growth.built.length - 1];
  if (!growth || !id) return null;
  const building = buildings.find((entry) => entry.id === id);
  if (!building) return null;
  const plot = plotAtRect(building.footprint);
  return {
    id: building.id,
    name: building.name,
    plotId: plot?.id ?? '',
    plotLabel: plot?.label ?? 'unbekanntes Grundstück',
    day: growth.lastBuildDay,
    cost: BUILD_COST,
  };
}

export function cityGrowthView(world: WorldState, ledger: Ledger): CityGrowthView {
  const buildings = cityBuildings(world);
  const market = jobMarket(buildings, world.cityLife?.residents ?? []);
  const capital = ledger.getBalance(BUILDER_ACCOUNT);
  const freePlots = CITY_PLOTS.filter((plot) => !buildings.some((b) => plotAtRect(b.footprint)?.id === plot.id)).length;
  const blockedReason: CityGrowthBlock = market.jobless <= 0 ? 'NO_JOBLESS'
    : freePlots <= 0 ? 'NO_PLOTS' : 'READY';
  return {
    ...market,
    capital,
    freePlots,
    canBuild: blockedReason === 'READY',
    blockedReason,
    built: world.cityGrowth?.built.length ?? 0,
    lastBuild: lastBuildOf(buildings, world.cityGrowth),
  };
}
