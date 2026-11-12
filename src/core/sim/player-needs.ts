/**
 * Spielerbeduerfnisse: Hunger und Durst als echter, gespeicherter Spielzustand.
 *
 * Der Wert ist 0 = satt, 100 = dringend. Der Tick hebt ihn langsam; eine
 * Mahlzeit oder ein Getraenk in Wohnung bzw. Kiez senkt ihn wieder. Derselbe
 * Zustand ist kein Anzeigewert: Stadtruf und Job-Ergebnis lesen ihn.
 */
import type { PlayerNeeds, WorldState } from './types';
import { playerApartmentFurniture } from './player-apartment';
import { grantGlobalXp } from './player-rpg';

export const PLAYER_HUNGER_PER_TICK = 0.03;
export const PLAYER_THIRST_PER_TICK = 0.04;
export const PLAYER_HUNGER_URGENT = 80;
export const PLAYER_THIRST_URGENT = 80;
export const PLAYER_NEED_STRAINED = 60;
export const PLAYER_MEAL_HUNGER = 45;
export const PLAYER_MEAL_THIRST = 10;
export const PLAYER_DRINK_THIRST = 55;
export const PLAYER_DRINK_HUNGER = 5;
export const PLAYER_MEAL_XP = 4;
export const PLAYER_DRINK_XP = 3;

export interface PlayerCondition {
  readonly hungry: boolean;
  readonly thirsty: boolean;
  readonly strained: boolean;
  readonly urgent: boolean;
  readonly label: string;
  /** Rufmultiplikator fuer Stadt-Handlungen; sichtbar und testbar. */
  readonly reputationFactor: number;
  /** XP-Multiplikator fuer Job-Schichten. */
  readonly workXpFactor: number;
  /** Unfallmultiplikator fuer Job-Schichten. */
  readonly injuryFactor: number;
}

export interface PlayerNeedsView {
  readonly hunger: number;
  readonly thirst: number;
  readonly condition: string;
  readonly reputationPercent: number;
  readonly workXpPercent: number;
  readonly injuryPercent: number;
  readonly effect: string;
}

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function createPlayerNeeds(custom: Partial<PlayerNeeds> = {}): PlayerNeeds {
  return {
    hunger: round2(clamp(numberOr(custom.hunger, 18))),
    thirst: round2(clamp(numberOr(custom.thirst, 22))),
  };
}

/** Alte Saves tragen kein `needs`; ein fehlendes Feld ist der Startzustand, kein Save-Bruch. */
export function normalizePlayerNeeds(raw: unknown): PlayerNeeds {
  const value = raw && typeof raw === 'object' ? raw as Partial<PlayerNeeds> : {};
  return createPlayerNeeds({
    hunger: numberOr(value.hunger, 18),
    thirst: numberOr(value.thirst, 22),
  });
}

/** Ein Tick Zeit: Hunger und Durst steigen langsam, ohne Sprung oder Zufall. */
export function tickPlayerNeeds(needs: PlayerNeeds, ticks = 1): PlayerNeeds {
  const elapsed = Math.max(0, Math.floor(ticks));
  // Nicht auf ganze Zehntel runden: 0.03 pro Tick wuerde sonst jeden Tick
  // auf den Ausgangswert zurueckfallen und nie kumulieren.
  return {
    hunger: round2(clamp(needs.hunger + PLAYER_HUNGER_PER_TICK * elapsed)),
    thirst: round2(clamp(needs.thirst + PLAYER_THIRST_PER_TICK * elapsed)),
  };
}

export function playerCondition(needs: PlayerNeeds): PlayerCondition {
  const hungry = needs.hunger >= PLAYER_HUNGER_URGENT;
  const thirsty = needs.thirst >= PLAYER_THIRST_URGENT;
  const strained = hungry || thirsty || needs.hunger >= PLAYER_NEED_STRAINED || needs.thirst >= PLAYER_NEED_STRAINED;
  const label = hungry && thirsty
    ? 'Hunger und Durst drücken'
    : hungry
      ? 'Hunger drückt'
      : thirsty
        ? 'Durst drückt'
        : strained
          ? 'Angeschlagen'
          : 'Satt und wach';
  return {
    hungry, thirsty, strained, urgent: hungry || thirsty, label,
    reputationFactor: hungry || thirsty ? 0.5 : strained ? 0.75 : 1,
    workXpFactor: hungry || thirsty ? 0.6 : strained ? 0.8 : 1,
    injuryFactor: hungry || thirsty ? 1.5 : strained ? 1.25 : 1,
  };
}

export function playerNeedsView(needs: PlayerNeeds): PlayerNeedsView {
  const condition = playerCondition(needs);
  return {
    hunger: Math.round(needs.hunger),
    thirst: Math.round(needs.thirst),
    condition: condition.label,
    reputationPercent: Math.round(condition.reputationFactor * 100),
    workXpPercent: Math.round(condition.workXpFactor * 100),
    injuryPercent: Math.round(condition.injuryFactor * 100),
    effect: `${condition.label} · Stadtruf ${Math.round(condition.reputationFactor * 100)} % · Job-XP ${Math.round(condition.workXpFactor * 100)} % · Unfallrisiko ${Math.round(condition.injuryFactor * 100)} %`,
  };
}

/** Eine Mahlzeit oder ein Getraenk senkt nur die passenden Werte, nie unter null. */
export function applyPlayerFood(needs: PlayerNeeds, kind: 'MEAL' | 'DRINK'): PlayerNeeds {
  if (kind === 'MEAL') {
    return { hunger: round1(clamp(needs.hunger - PLAYER_MEAL_HUNGER)), thirst: round1(clamp(needs.thirst - PLAYER_MEAL_THIRST)) };
  }
  return { hunger: round1(clamp(needs.hunger - PLAYER_DRINK_HUNGER)), thirst: round1(clamp(needs.thirst - PLAYER_DRINK_THIRST)) };
}

/** Rufgewinn einer Stadt-Handlung; der Zustand des Spielers ist der Faktor. */
export function cityReputationGain(needs: PlayerNeeds, base: number): number {
  return Math.round(base * playerCondition(needs).reputationFactor * 100) / 100;
}

function homeItem(world: WorldState, label: string): { readonly x: number; readonly y: number; readonly label: string } {
  if (world.scene.kind !== 'APARTMENT') throw new Error('Essen und Trinken zu Hause geht nur in deiner Wohnung.');
  const item = playerApartmentFurniture().find((entry) => entry.label.includes(label));
  if (!item) throw new Error('Das passende Haushaltsgeraet fehlt.');
  if (!near(world, item)) throw new Error('Geh erst an die Kuechenzeile.');
  return item;
}

function near(world: WorldState, item: { readonly x: number; readonly y: number }): boolean {
  return Math.abs(world.player.position.x - item.x) + Math.abs(world.player.position.y - item.y) <= 3;
}

/** Essen an der Kochnische: Hunger sinkt, Durst sinkt mit, Erfahrung wird gutgeschrieben. */
export function eatAtHome(world: WorldState): void {
  if (world.player.needs.hunger <= 5) throw new Error('Du bist satt.');
  homeItem(world, 'Kochnische');
  world.player.needs = applyPlayerFood(world.player.needs, 'MEAL');
  grantGlobalXp(world.player.rpg, 'HOME_MEAL', PLAYER_MEAL_XP);
  world.lastEvent = `Du isst an der Kochnische. Hunger ${Math.round(world.player.needs.hunger)}, Durst ${Math.round(world.player.needs.thirst)}.`;
}

/** Trinken am Kuehlschrank: Durst sinkt deutlich, der Hunger nur leicht. */
export function drinkAtHome(world: WorldState): void {
  if (world.player.needs.thirst <= 5) throw new Error('Du hast keinen Durst.');
  homeItem(world, 'Kühlschrank');
  world.player.needs = applyPlayerFood(world.player.needs, 'DRINK');
  grantGlobalXp(world.player.rpg, 'HOME_DRINK', PLAYER_DRINK_XP);
  world.lastEvent = `Du trinkst am Kuehlschrank. Durst ${Math.round(world.player.needs.thirst)}, Hunger ${Math.round(world.player.needs.hunger)}.`;
}
