/**
 * @module city-households — Wohnadresse und Haushalt eines Stadtbewohners
 *
 * Jeder Bewohner traegt seine Wohnung als Kennung im Save. Die Zuordnung wird
 * gegen die tatsaechlich vorhandenen Wohngebaeude aufgeloest; neue Bewohner
 * werden deterministisch und kapazitaetsgebunden verteilt, statt alle an der
 * Spielerwohnung zu haengen. Gibt es noch kein NPC-Wohnhaus, bleibt die
 * Spielerwohnung ein ausdruecklich geteilter Ausweich-Haushalt — ob die Stadt
 * spaeter eigene Haeuser baut oder Wohngemeinschaften modelliert, ist eine
 * Produktentscheidung und nicht Teil dieser Zuordnung.
 */
import { CITY_PRESET_BUILDINGS } from './building';
import type { BuildingState } from './building-types';
import type { CityResidentState } from './city-life-types';
import type { WorldState } from './types';

/** Die Spielerwohnung ist kein NPC-Zuhause; sie ist nur der Ausweichort. */
export const PLAYER_HOME_BUILDING = 'bld_player_home';
/** Haushaltsgroesse je NPC-Wohnhaus; die Spielerwohnung bleibt beim Spieler. */
export const HOUSEHOLD_CAPACITY = 3;
/** Ein Haushalt ist eine Wohnung, nicht eine Person: mehrere teilen sich eine. */
export function householdIdFor(buildingId: string): string {
  return `household_${buildingId.replace(/^bld_/, '')}`;
}
/** Ausweich-Haushalt, solange die Stadt kein eigenes NPC-Wohnhaus hat. */
export const SHARED_HOUSEHOLD_ID = 'household_shared_player_home';

/** Wohngebaeude, die NPCs beziehen koennen; die Spielerwohnung zaehlt nicht. */
export function npcHomeBuildings(buildings: readonly BuildingState[]): readonly BuildingState[] {
  return buildings.filter((building) =>
    building.kind === 'RESIDENCE' && building.id !== PLAYER_HOME_BUILDING);
}

/** Die aufgeloeste Wohnung: gespeicherte Kennung, sonst der Ausweichort. */
export function homeFor(
  resident: Pick<CityResidentState, 'homeBuildingId'>,
  buildings: readonly BuildingState[],
): string {
  const known = npcHomeBuildings(buildings).some((building) => building.id === resident.homeBuildingId);
  return known ? resident.homeBuildingId : PLAYER_HOME_BUILDING;
}

/**
 * Verteilt Bewohner deterministisch auf die vorhandenen NPC-Wohnungen.
 * Gueltige gespeicherte Adressen bleiben, solange ihre Kapazitaet reicht; neue
 * Bewohner werden reihum gesetzt. Ohne Wohnhaus faellt die Adresse auf den
 * geteilten Ausweich-Haushalt, nie auf eine erfundene Wohnung.
 */
export function assignHouseholds(
  residents: readonly CityResidentState[],
  buildings: readonly BuildingState[],
): readonly CityResidentState[] {
  const homes = npcHomeBuildings(buildings);
  const capacity = new Map<string, number>();
  const next: CityResidentState[] = [];
  for (const [index, resident] of residents.entries()) {
    const stored = homes.some((building) => building.id === resident.homeBuildingId)
      ? resident.homeBuildingId : null;
    let home = stored && (capacity.get(stored) ?? 0) < HOUSEHOLD_CAPACITY ? stored : null;
    if (!home && homes.length > 0) {
      for (let offset = 0; offset < homes.length; offset += 1) {
        const candidate = homes[(index + offset) % homes.length]!;
        if ((capacity.get(candidate.id) ?? 0) < HOUSEHOLD_CAPACITY) {
          home = candidate.id;
          break;
        }
      }
    }
    const buildingId = home ?? PLAYER_HOME_BUILDING;
    const householdId = home ? householdIdFor(home) : SHARED_HOUSEHOLD_ID;
    capacity.set(buildingId, (capacity.get(buildingId) ?? 0) + 1);
    next.push(resident.homeBuildingId === buildingId && resident.householdId === householdId
      ? resident
      : { ...resident, homeBuildingId: buildingId, householdId });
  }
  return next;
}

/** Laedt die Wohnzuordnung fuer eine Welt nach; unveraenderte Listen bleiben. */
export function ensureHouseholds(world: WorldState): void {
  const life = world.cityLife;
  if (!life) return;
  const buildings = world.cityScene?.exterior.buildings ?? CITY_PRESET_BUILDINGS;
  const residents = assignHouseholds(life.residents, buildings);
  if (residents.some((resident, index) => resident !== life.residents[index])) {
    world.cityLife = { ...life, residents };
  }
}
