/**
 * @module city-life-state — Initialisierung, Wachstum und Save-Migration
 *
 * Dieser Teil kennt nur den persistierbaren Zustand. Die stundenweise
 * Simulation und die UI-Sicht liegen in `city-life.ts`, damit keine Datei
 * mehrere Verantwortungen in der Hot Zone traegt.
 *
 * Die Bewohnerschaft ist eine Liste, keine Konstante: `ensureCityLife` legt sie
 * bei Bedarf an, `ensureCityPopulation` erweitert sie, und `bindCityIdentities`
 * gibt jedem Mitglied ein Profil — auch dem zwanzigsten.
 */
import type { CityLifeState } from './city-life-types';
import { createCityLifeState, growCityPopulation } from './city-life-create';
import { normalizeCityLife } from './city-life-restore';
import { bindCityIdentities } from './city-identity';
import type { WorldState } from './types';

export { createCityLifeState, normalizeCityLife, growCityPopulation };

function hasResidents(raw: unknown): raw is CityLifeState {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as CityLifeState).residents);
}

/** Initialisiert das Stadtleben auch fuer Saves, die vor diesem Slice entstanden. */
export function ensureCityLife(world: WorldState): CityLifeState {
  if (!hasResidents(world.cityLife)) {
    world.cityLife = createCityLifeState();
  }
  // Der Name ist Anzeige; die Kennung verbindet Bewohner und Profil.
  bindCityIdentities(world);
  return world.cityLife;
}

/**
 * Zielgroesse der Stadt. Bestehende Bewohner bleiben, neue kommen aus der
 * Besetzung dazu; die Rueckgabe ist die Zahl der Neuen.
 */
export function ensureCityPopulation(world: WorldState, target: number): number {
  const life = ensureCityLife(world);
  const next = growCityPopulation(life, target);
  if (next === life) return 0;
  const added = next.residents.length - life.residents.length;
  world.cityLife = next;
  bindCityIdentities(world);
  return added;
}
