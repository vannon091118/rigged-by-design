/** Stadt-Handlungen: pruefen, fortschreiben, Text und Ergebnis setzen. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
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
import { advanceToNextDay } from './tick';
import { applyPlayerFood, cityReputationGain, createPlayerNeeds, normalizePlayerNeeds, playerNeedsView, PLAYER_DRINK_XP, PLAYER_MEAL_XP } from './player-needs';
import { needAtMost } from './needs-core';
import { grantGlobalXp } from './player-rpg';

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
  const needs = normalizePlayerNeeds(world.player.needs);
  if (action.id === 'KIEZ_ESSEN' || action.id === 'KIEZ_TRINKEN') {
    if (state.energy < action.energy) {
      throw new Error(`Zu wenig Energie (${state.energy}/${action.energy}). Der naechste Tag fuellt sie auf.`);
    }
    if (action.id === 'KIEZ_ESSEN') {
      if (needAtMost(needs.hunger, 5)) throw new Error('Du bist satt.');
      world.player.needs = applyPlayerFood(needs, 'MEAL');
      grantGlobalXp(world.player.rpg, 'KIEZ_MEAL', PLAYER_MEAL_XP);
    } else {
      if (needAtMost(needs.thirst, 5)) throw new Error('Du hast keinen Durst.');
      world.player.needs = applyPlayerFood(needs, 'DRINK');
      grantGlobalXp(world.player.rpg, 'KIEZ_DRINK', PLAYER_DRINK_XP);
    }
    const next: CityState = {
      ...state,
      energy: clampEnergy(state.energy - action.energy),
      lastText: cityText(`${action.id}|${state.location}|${state.KIEZ}`),
      lastResult: `${action.label}: Hunger ${Math.round(world.player.needs.hunger)}, Durst ${Math.round(world.player.needs.thirst)}.`,
    };
    world.city = next;
    world.lastEvent = next.lastResult;
    return next;
  }
  if (state.energy < action.energy) {
    throw new Error(`Zu wenig Energie (${state.energy}/${action.energy}). Der naechste Tag fuellt sie auf.`);
  }
  const points = state[action.branch] + action.progress;
  const done = [...state.completed];
  if (points >= finalTier(action.branch) && !done.includes(action.branch)) done.push(action.branch);
  // Der Textschluessel traegt den erreichten Stand: `visits` bleibt waehrend
  // eines Aufenthalts konstant und `world.tick` laeuft bei Stadt-Handlungen
  // nicht weiter. Mit beiden allein las jede Handlung im selben Aufenthalt
  // denselben Satz - 52 Bausteine, aber ein Text. Der Fortschritt aendert sich
  // mit jeder Handlung und bleibt deterministisch.
  const key = `${action.id}|${state.location}|${points}`;
  const reputationGain = cityReputationGain(needs, action.reputation);
  const condition = playerNeedsView(needs);
  const next: CityState = {
    ...state,
    energy: clampEnergy(state.energy - action.energy),
    KIEZ: action.branch === 'KIEZ' ? points : state.KIEZ,
    MARKT: action.branch === 'MARKT' ? points : state.MARKT,
    completed: done,
    lastText: cityText(key),
    lastResult: `${action.label}: ${action.branch} ${points} Punkte, Rang ${tierOf(action.branch, points).name}${condition.condition === 'Satt und wach' ? '' : ` · ${condition.condition}: Ruf +${reputationGain.toFixed(2)}`}.`,
  };
  world.city = next;
  world.reputation = Math.max(0, world.reputation + reputationGain);
  world.lastEvent = next.lastResult;
  return next;
}

/**
 * Tag beenden: die einzige Erholung der Stadt. Die Uhr laeuft bis zum naechsten
 * Tageswechsel durch den kanonischen Tick; dort werden Loehne, Miete, Strafen
 * und Fremd-Floors verarbeitet. Die Stadt fuehrt keinen zweiten Kalender.
 */
export function restInCity(world: WorldState, ledger: Ledger, prng: Prng): CityState {
  const state = cityOf(world);
  advanceToNextDay(world, ledger, prng);
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
export function actionViews(state: CityState, needs = createPlayerNeeds()): CityActionView[] {
  const sated = needAtMost(needs.hunger, 5);
  const quenched = needAtMost(needs.thirst, 5);
  return ACTIONS.map((action) => {
    const blocked = action.branch === 'MARKT' && !marketUnlocked(state)
      ? `Markt erst ab Kiez-Rang Stammgast (${state.KIEZ}/${MARKET_UNLOCK_AT}).`
      : state.location !== action.location
        ? `Du bist in ${state.location}.`
        : action.id === 'KIEZ_ESSEN' && sated
          ? 'Du bist satt.'
          : action.id === 'KIEZ_TRINKEN' && quenched
            ? 'Du hast keinen Durst.'
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
