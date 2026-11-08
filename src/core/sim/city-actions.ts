/** Stadt-Handlungen: pruefen, fortschreiben, Text und Ergebnis setzen. */
import type { WorldState } from './types';
import type { CityActionView, CityState } from './city-types';
import {
  ACTIONS,
  CITY_ENERGY_PER_DAY,
  MARKET_UNLOCK_AT,
  cityOf,
  cityNightText,
  cityText,
  clampEnergy,
  finalTier,
  marketUnlocked,
  tierOf,
} from './city-model';

/**
 * Eine Handlung im Ort: pruefen, dann fortschreiben. Ein Fehler veraendert
 * nichts; erst nach allen Pruefungen wird der Zustand ersetzt.
 */
export function runCityAction(world: WorldState, actionId: string): CityState {
  const state = cityOf(world);
  const action = ACTIONS.find((entry) => entry.id === actionId);
  if (!action) throw new Error(`Unbekannte Handlung: ${String(actionId)}`);
  if (state.location !== action.location) {
    throw new Error(`Diese Handlung gehoert zu ${action.location}, du bist in ${state.location}.`);
  }
  if (action.branch === 'MARKT' && !marketUnlocked(state)) {
    throw new Error(`Der Markt oeffnet erst ab Kiez-Rang Stammgast (${state.KIEZ}/${MARKET_UNLOCK_AT}).`);
  }
  if (state.energy < action.energy) {
    throw new Error(`Zu wenig Energie (${state.energy}/${action.energy}). Der naechste Tag fuellt sie auf.`);
  }
  const points = state[action.branch] + action.progress;
  const done = [...state.completed];
  if (points >= finalTier(action.branch) && !done.includes(action.branch)) done.push(action.branch);
  const key = `${action.id}|${state.visits[state.location]}|${world.tick}`;
  const next: CityState = {
    ...state,
    energy: clampEnergy(state.energy - action.energy),
    KIEZ: action.branch === 'KIEZ' ? points : state.KIEZ,
    MARKT: action.branch === 'MARKT' ? points : state.MARKT,
    completed: done,
    lastText: cityText(key),
    lastResult: `${action.label}: ${action.branch} ${points} Punkte, Rang ${tierOf(action.branch, points).name}.`,
  };
  world.city = next;
  world.reputation = Math.max(0, world.reputation + action.reputation);
  world.lastEvent = next.lastResult;
  return next;
}

/**
 * Tag beenden: die einzige Erholung der Stadt. Sie schreibt den Tag fort, statt
 * Energie zu schenken - damit bleibt der Kalender die eine Zeitwahrheit.
 */
export function restInCity(world: WorldState): CityState {
  const state = cityOf(world);
  world.day += 1;
  const next: CityState = {
    ...state,
    energyDay: world.day,
    energy: CITY_ENERGY_PER_DAY,
    lastText: cityNightText(`rest|${world.day}|${state.location}`),
    lastResult: `Tag ${world.day}: neue Energie, die Stadt wartet schon.`,
  };
  world.city = next;
  world.lastEvent = next.lastResult;
  return next;
}

/** Warum eine Handlung gerade nicht geht - Zweigsperre zuerst, dann Ort, dann Energie. */
export function actionViews(state: CityState): CityActionView[] {
  return ACTIONS.map((action) => {
    const blocked = action.branch === 'MARKT' && !marketUnlocked(state)
      ? `Markt erst ab Kiez-Rang Stammgast (${state.KIEZ}/${MARKET_UNLOCK_AT}).`
      : state.location !== action.location
        ? `Du bist in ${state.location}.`
        : state.energy < action.energy
          ? `Energie ${state.energy}/${action.energy}.`
          : '';
    return {
      id: action.id,
      label: action.label,
      hint: action.hint,
      energy: action.energy,
      branch: action.branch,
      progress: action.progress,
      enabled: blocked === '',
      blocked,
    };
  });
}
