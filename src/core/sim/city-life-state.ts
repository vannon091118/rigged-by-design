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
import {
  defaultSkills, normalizeAttributes, normalizeLastDecisions, normalizeMemories,
  normalizeRelationships, normalizeSkills, seedOffset,
} from './city-life-normalize';
import type { NpcIntentKind, NpcNeeds } from './npc-types';
import type { WorldState } from './types';

export const TICKS_PER_HOUR = TICKS_PER_DAY / 24;

const INITIAL_NEEDS: Readonly<Record<string, Partial<NpcNeeds>>> = {
  rita: { hunger: 34, thirst: 30, fatigue: 18, social: 48, money: 8200, mood: 72 },
  boris: { hunger: 24, thirst: 72, fatigue: 14, social: 28, money: 12400, mood: 64 },
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

function initialResident(def: CityNpcDef, seed: number): CityResidentState {
  const base = createDefaultNeeds(INITIAL_NEEDS[def.id]);
  return {
    npcId: def.id,
    name: def.name,
    role: def.role,
    location: 'HOME',
    intent: 'SLEEP',
    needs: {
      ...base,
      hunger: Math.max(0, Math.min(100, base.hunger + seedOffset(seed, def.id, 'hunger'))),
      thirst: Math.max(0, Math.min(100, base.thirst + seedOffset(seed, def.id, 'thirst'))),
      fatigue: Math.max(0, Math.min(100, base.fatigue + seedOffset(seed, def.id, 'fatigue'))),
      social: Math.max(0, Math.min(100, base.social + seedOffset(seed, def.id, 'social'))),
    },
    attributes: { charisma: def.charisma, intellect: def.intellect },
    skills: defaultSkills(),
    relationships: {},
    memories: [],
    lastHour: 0,
    lastDay: 0,
  };
}

export function createCityLifeState(seed = 0): CityLifeState {
  return {
    residents: CITY_NPCS.map((def) => initialResident(def, seed)),
    seed,
    decisionSeq: 0,
    memorySeq: 1,
    lastDecisions: [],
  };
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
  const source = raw as Record<string, unknown>;
  const seed = asNumber(source.seed, 0, 0, Number.MAX_SAFE_INTEGER);
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of source.residents as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.npcId === 'string') byId.set(record.npcId, record);
  }
  const ids = CITY_NPCS.map((def) => def.id);
  const residents = CITY_NPCS.map((def) => {
    const fresh = initialResident(def, seed);
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
      attributes: normalizeAttributes(record.attributes, fresh.attributes),
      skills: normalizeSkills(record.skills, fresh.skills),
      relationships: normalizeRelationships(record.relationships, def.id, ids),
      memories: normalizeMemories(record.memories),
      lastHour: asNumber(record.lastHour, fresh.lastHour, 0, 23),
      lastDay: asNumber(record.lastDay, fresh.lastDay, 0, Number.MAX_SAFE_INTEGER),
    };
  });
  const maxMemory = residents.reduce((max, resident) => Math.max(max,
    ...resident.memories.map((memory) => memory.id)), 0);

  return {
    seed,
    decisionSeq: asNumber(source.decisionSeq, 0, 0, Number.MAX_SAFE_INTEGER),
    memorySeq: Math.max(1, maxMemory + 1, asNumber(source.memorySeq, 1, 1, Number.MAX_SAFE_INTEGER)),
    lastDecisions: normalizeLastDecisions(source.lastDecisions),
    residents,
  };
}

/** Initialisiert das Stadtleben auch fuer Saves, die vor diesem Slice entstanden. */
export function ensureCityLife(world: WorldState): CityLifeState {
  if (!containsResident(world.cityLife)) {
    world.cityLife = createCityLifeState();
  }
  return world.cityLife;
}
