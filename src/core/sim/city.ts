/**
 * Stadt: der erste Vertical Slice ausserhalb des eigenen Floors.
 *
 * Ein Besuch ist ein echter Zustandsuebergang, keine Anzeige: Reisen setzt den
 * Ort, eine Handlung kostet Energie, veraendert Fortschritt und Ruf, und der
 * Text kommt aus dem Pool `city-scene` - nie aus einem String im UI. Alles ist
 * headless, deterministisch und ohne eigene Geldwahrheit: Geld bewegt sich nur
 * ueber den Ledger des Casinos, die Stadt bucht keine Betraege.
 *
 * Zwei Zweige laufen unabhaengig: KIEZ (Kontakte) und MARKT (Handel). Der
 * Markt oeffnet erst, wenn der Kiez den dritten Rang erreicht hat.
 *
 * Aufteilung: `city-types` beschreibt, `city-model` haelt Daten und Zustand,
 * `city-actions` handelt, diese Datei ist die oeffentliche Fassade.
 */
import type { WorldState } from './types';
import type { CityBranchView, CityLocationId, CityState, CityView } from './city-types';
import {
  CITY_ENERGY_PER_DAY,
  LOCATIONS,
  ORDER,
  TIERS,
  branchDone,
  cityOf,
  marketUnlocked,
  tierOf,
} from './city-model';
import { actionViews } from './city-actions';
import { cityLifeView } from './city-life';

export type { CityActionView, CityBranchId, CityBranchView, CityLocationId, CityState, CityView } from './city-types';
export { CITY_ENERGY_PER_DAY, CITY_SLOT, NIGHT_SLOT, cityNightText, cityOf, cityText, marketUnlocked, tierOf } from './city-model';
export { restInCity, runCityAction } from './city-actions';

/** Reisen: setzt den Ort, zaehlt den Besuch und meldet den Wechsel im Log. */
export function travel(world: WorldState, location: CityLocationId): CityState {
  const state = cityOf(world);
  if (!ORDER.includes(location)) throw new Error(`Unbekannter Ort: ${String(location)}`);
  if (location === 'MARKT' && !marketUnlocked(state)) {
    throw new Error(`Der Markt oeffnet erst ab Kiez-Rang Stammgast (${state.KIEZ}/9).`);
  }
  const next: CityState = {
    ...state,
    location,
    visits: { ...state.visits, [location]: (state.visits[location] ?? 0) + 1 },
  };
  world.city = next;
  world.lastEvent = location === 'CASINO'
    ? 'Zurueck im eigenen Casino.'
    : `Angekommen: ${LOCATIONS.find((entry) => entry.id === location)!.name}.`;
  return next;
}

/** Die Sicht der UI: alles abgeleitet, nichts davon ein zweiter Zustand. */
export function cityView(world: WorldState): CityView {
  const state = cityOf(world);
  const location = LOCATIONS.find((entry) => entry.id === state.location)!;
  const branches = (['KIEZ', 'MARKT'] as const).map((id): CityBranchView => {
    const points = id === 'KIEZ' ? state.KIEZ : state.MARKT;
    const tier = tierOf(id, points);
    const tiers = TIERS[id];
    return {
      id,
      name: id === 'KIEZ' ? 'Kiez' : 'Markt',
      tier: tier.name,
      next: tier.next?.name ?? null,
      points,
      need: tier.next?.at ?? tiers[tiers.length - 1]!.at,
      done: branchDone(state, id),
      unlocked: id === 'MARKT' ? marketUnlocked(state) : true,
    };
  });
  return {
    residents: cityLifeView(world),
    location: state.location,
    locationName: location.name,
    note: location.note,
    energy: state.energy,
    energyMax: CITY_ENERGY_PER_DAY,
    branches,
    actions: actionViews(state),
    // Ein Ort, den `travel` ablehnen wuerde, ist hier sichtbar gesperrt: keine Tuer ohne Wirkung.
    locations: LOCATIONS.map((entry) => ({
      id: entry.id,
      name: entry.name,
      here: entry.id === state.location,
      locked: entry.id === 'MARKT' && !marketUnlocked(state),
    })),
    lastText: state.lastText,
    lastResult: state.lastResult,
    completed: state.completed,
  };
}
