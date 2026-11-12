/**
 * @module city-life-state — Initialisierung und Save-Migration des Stadtlebens
 *
 * Dieser Teil kennt nur den persistierbaren Zustand. Die stundenweise
 * Simulation und die UI-Sicht liegen in `city-life.ts`, damit keine Datei
 * mehrere Verantwortungen in der Hot Zone traegt.
 */
import { TICKS_PER_DAY } from './demand';
import { CITY_NPCS, type CityNpcDef } from './city-npcs';
import type { CityLifePlace, CityLifeState, CityResidentState } from './city-life-types';
import { createDefaultNeeds } from './npc-needs';
import type { NpcIntentKind, NpcNeeds } from './npc-types';
import type { WorldState } from './types';

export const TICKS_PER_HOUR = TICKS_PER_DAY / 24;

const INITIAL_NEEDS: Readonly<Record<string, Partial<NpcNeeds>>> = {
  rita: { hunger: 34, thirst: 30, fatigue: 18, social: 48, money: 8200, mood: 72 },
  boris: { hunger: 24, thirst: 26, fatigue: 14, social: 28, money: 12400, mood: 64 },
  mira: { hunger: 42, thirst: 38, fatigue: 26, social: 62, money: 6100, mood: 76 },
};

const PLACES: ReadonlySet<string> = new Set(['HOME', 'KIEZ', 'MARKT', 'CASINO']);
const INTENT_NAMES: ReadonlySet<string> = new Set([
  'SLEEP', 'WAKE_UP', 'EAT_HOME', 'EAT_OUT', 'WORK', 'LEISURE',
  'VISIT_FRIEND', 'SHOP', 'PUB', 'COMMUTE', 'IDLE',
]);

export function hourOf(tick: number): number {
  const dayTick = ((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  return Math.floor(dayTick / TICKS_PER_HOUR);
}

function initialResident(def: CityNpcDef): CityResidentState {
  return {
    npcId: def.id,
    name: def.name,
    role: def.role,
    location: 'HOME',
    intent: 'SLEEP',
    needs: createDefaultNeeds(INITIAL_NEEDS[def.id]),
    lastHour: 0,
    lastDay: 0,
  };
}

export function createCityLifeState(): CityLifeState {
  return { residents: CITY_NPCS.map(initialResident) };
}

function containsResident(raw: unknown): raw is { residents: unknown[] } {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { residents?: unknown }).residents);
}

function asNumber(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

/**
 * Save-Migration: alte Saves ohne Stadtleben bekommen einen frischen,
 * deterministischen Startzustand; vorhandene Bewohner behalten ihre Werte.
 */
export function normalizeCityLife(raw: unknown): CityLifeState {
  if (!containsResident(raw)) return createCityLifeState();
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of raw.residents) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.npcId === 'string') byId.set(record.npcId, record);
  }

  return {
    residents: CITY_NPCS.map((def) => {
      const fresh = initialResident(def);
      const record = byId.get(def.id);
      if (!record) return fresh;
      const rawNeeds = typeof record.needs === 'object' && record.needs !== null
        ? record.needs as Partial<NpcNeeds>
        : {};
      const needs = createDefaultNeeds({
        hunger: asNumber(rawNeeds.hunger, fresh.needs.hunger, 0, 100),
        thirst: asNumber(rawNeeds.thirst, fresh.needs.thirst, 0, 100),
        fatigue: asNumber(rawNeeds.fatigue, fresh.needs.fatigue, 0, 100),
        social: asNumber(rawNeeds.social, fresh.needs.social, 0, 100),
        money: asNumber(rawNeeds.money, fresh.needs.money, 0, Number.MAX_SAFE_INTEGER),
        mood: asNumber(rawNeeds.mood, fresh.needs.mood, 0, 100),
      });
      const location = typeof record.location === 'string' && PLACES.has(record.location)
        ? record.location as CityLifePlace
        : fresh.location;
      const intent = typeof record.intent === 'string' && INTENT_NAMES.has(record.intent)
        ? record.intent as NpcIntentKind
        : fresh.intent;
      return {
        npcId: def.id,
        name: def.name,
        role: def.role,
        location,
        intent,
        needs,
        lastHour: asNumber(record.lastHour, fresh.lastHour, 0, 23),
        lastDay: asNumber(record.lastDay, fresh.lastDay, 0, Number.MAX_SAFE_INTEGER),
      };
    }),
  };
}

/** Initialisiert das Stadtleben auch fuer Saves, die vor diesem Slice entstanden. */
export function ensureCityLife(world: WorldState): CityLifeState {
  if (!containsResident(world.cityLife)) {
    world.cityLife = createCityLifeState();
  }
  return world.cityLife;
}
