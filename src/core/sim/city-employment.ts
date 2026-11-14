/**
 * @module city-employment — Stellen sind Zuordnungen, keine Differenz
 *
 * Jede Stelle gehoert einer konkreten Figur. Die Zuordnung ist eine reine
 * Funktion aus Bewohnerliste und Gebaeuden: gleiche Eingabe, gleiche Stellen.
 * Sie braucht damit keinen Save-Eintrag und keine Migration; nach dem Laden
 * entsteht dieselbe Belegung wieder.
 */
import type { BuildingKind, BuildingState } from './building-types';

/** Arbeitsplaetze je Gebaeudeart; Wohnungen geben keine Arbeit. */
export const JOB_CAPACITY: Readonly<Record<BuildingKind, number>> = Object.freeze({
  APARTMENT: 0, RESIDENCE: 0, PUB: 6, SHOP: 5, CASINO: 8, OFFICE: 4, WORKSHOP: 3,
});

export interface EmploymentCandidate {
  readonly npcId: string;
  /** Wunschbetrieb aus der Besetzung; ohne freie Stelle faellt die Vergabe weiter. */
  readonly preferredBuildingId?: string | null;
}

export interface CityJobMarket {
  readonly residents: number;
  readonly jobs: number;
  readonly employed: number;
  /** Stellen, die noch frei sind. */
  readonly openSlots: number;
  /** Bewohner ohne Stelle: das Signal, dass die Stadt bauen darf. */
  readonly jobless: number;
}

/**
 * Belegbar ist nur ein Haus, das offen steht und einen echten Eingang hat.
 * Ein Neubau startet versiegelt (`locked`, `entrance -1/-1`): niemand kommt
 * hinein, also darf er auch keine Stellen vergeben (#566).
 */
export function isBookable(building: BuildingState): boolean {
  return !building.locked && building.entrance.x >= 0 && building.entrance.y >= 0;
}

function capacityOf(buildings: readonly BuildingState[]): Map<string, number> {
  const capacity = new Map<string, number>();
  for (const building of buildings) {
    if (!isBookable(building)) continue;
    const slots = JOB_CAPACITY[building.kind] ?? 0;
    if (slots > 0) capacity.set(building.id, slots);
  }
  return capacity;
}

function take(capacity: Map<string, number>, buildingId: string | null | undefined): boolean {
  if (!buildingId) return false;
  const free = capacity.get(buildingId) ?? 0;
  if (free <= 0) return false;
  capacity.set(buildingId, free - 1);
  return true;
}

/**
 * Vergibt jede Stelle genau einmal. Erst der Wunschbetrieb der Figur, dann die
 * freien Plaetze in Gebaeudereihenfolge; wer danach keine Stelle hat, ist
 * arbeitslos. Die Reihenfolge haengt nur an der Eingabe, nie an Zufall.
 */
export function assignEmployment(
  candidates: readonly EmploymentCandidate[],
  buildings: readonly BuildingState[],
): ReadonlyMap<string, string> {
  const capacity = capacityOf(buildings);
  const assigned = new Map<string, string>();
  for (const candidate of candidates) {
    if (take(capacity, candidate.preferredBuildingId)) assigned.set(candidate.npcId, candidate.preferredBuildingId!);
  }
  for (const candidate of candidates) {
    if (assigned.has(candidate.npcId)) continue;
    for (const [buildingId, free] of capacity) {
      if (free <= 0) continue;
      if (take(capacity, buildingId)) { assigned.set(candidate.npcId, buildingId); break; }
    }
  }
  return assigned;
}

/** Arbeitsmarkt aus derselben Zuordnung, die auch die Schichten lesen. */
export function cityJobMarket(
  buildings: readonly BuildingState[],
  candidates: readonly EmploymentCandidate[],
): CityJobMarket {
  const jobs = buildings.reduce((sum, building) => sum + (isBookable(building) ? JOB_CAPACITY[building.kind] ?? 0 : 0), 0);
  const employed = assignEmployment(candidates, buildings).size;
  return {
    residents: candidates.length,
    jobs,
    employed,
    openSlots: Math.max(0, jobs - employed),
    jobless: Math.max(0, candidates.length - employed),
  };
}
