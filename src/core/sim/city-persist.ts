/** Save-Heilung des Stadtzustands: Ort, Energie und Begegnungen aus rohen Daten. */
import { CITY_ENERGY_PER_DAY, ORDER, cityText, clampEnergy } from './city-model';
import {
  ENCOUNTER_ACTIONS,
  type CityEncounterRecord,
  type CityLocationId,
  type CityState,
} from './city-types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const int = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : fallback;

/** Unbekannte Orte fallen auf das Casino, kaputte Begegnungen entfallen. */
export function normalizeCityState(raw: unknown, day: number): CityState | undefined {
  if (!isRecord(raw)) return undefined;
  const location = ORDER.includes(raw.location as CityLocationId) ? raw.location as CityLocationId : 'CASINO';
  const energyDay = int(raw.energyDay, 0, Number.MAX_SAFE_INTEGER, day);
  const encounters: CityEncounterRecord[] = [];
  if (Array.isArray(raw.encounters)) {
    for (const entry of raw.encounters.slice(-24)) {
      if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name.length === 0) continue;
      const action = entry.action as CityEncounterRecord['action'];
      if (!ENCOUNTER_ACTIONS.includes(action)) continue;
      encounters.push({
        npcId: int(entry.npcId, 1, Number.MAX_SAFE_INTEGER, 1),
        name: entry.name.slice(0, 80),
        location: ORDER.includes(entry.location as CityLocationId) ? entry.location as CityLocationId : location,
        day: int(entry.day, 0, Number.MAX_SAFE_INTEGER, day),
        tick: int(entry.tick, 0, Number.MAX_SAFE_INTEGER, 0),
        action,
        amount: int(entry.amount, 0, Number.MAX_SAFE_INTEGER, 0),
        trust: int(entry.trust, -10, 10, 0),
      });
    }
  }
  const visits = raw.visits as Record<string, unknown> | undefined;
  return {
    location,
    energyDay: day,
    energy: energyDay === day ? clampEnergy(int(raw.energy, 0, CITY_ENERGY_PER_DAY, CITY_ENERGY_PER_DAY)) : CITY_ENERGY_PER_DAY,
    KIEZ: int(raw.KIEZ, 0, Number.MAX_SAFE_INTEGER, 0),
    MARKT: int(raw.MARKT, 0, Number.MAX_SAFE_INTEGER, 0),
    visits: {
      CASINO: int(visits?.CASINO, 0, Number.MAX_SAFE_INTEGER, 0),
      KIEZ: int(visits?.KIEZ, 0, Number.MAX_SAFE_INTEGER, 0),
      MARKT: int(visits?.MARKT, 0, Number.MAX_SAFE_INTEGER, 0),
    },
    lastResult: typeof raw.lastResult === 'string' ? raw.lastResult.slice(0, 240) : 'Die Stadt wartet.',
    lastText: typeof raw.lastText === 'string' ? raw.lastText.slice(0, 800) : cityText('start|0'),
    completed: Array.isArray(raw.completed)
      ? raw.completed.filter((entry): entry is 'KIEZ' | 'MARKT' => entry === 'KIEZ' || entry === 'MARKT')
      : [],
    encounters,
  };
}
