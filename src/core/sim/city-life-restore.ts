/**
 * @module city-life-restore — Save-Migration der Bewohnerschaft
 *
 * Ein Save nennt Kennungen, keine Figuren: Alles Weitere laesst sich aus der
 * Besetzung herleiten. Deshalb behaelt das Laden jede Kennung, die die Besetzung
 * erklaeren kann — auch `npc_17` aus einer groesseren Stadt —, und erfindet nur
 * dann eine Figur, wenn der Save keine Spur von ihr hat. Die Zahlen eines
 * Bewohners werden begrenzt statt verworfen; ein kaputter Wert kostet einen Tag,
 * nicht den Menschen.
 */
import type { CityLifePlace, CityLifeState, CityResidentState } from './city-life-types';
import { CITY_POPULATION_DEFAULT, rosterDefById } from './city-npc-roster';
import { createCityLifeState } from './city-life-create';
import { createDefaultNeeds } from './npc-needs';
import {
  defaultSkills, normalizeAttributes, normalizeLastDecisions, normalizeMemories,
  normalizePosition, normalizeRelationships, normalizeSkills, normalizeTravel,
  normalizeVisitorId,
} from './city-life-normalize';
import type { NpcIntentKind, NpcNeeds } from './npc-types';

const PLACES: ReadonlySet<string> = new Set(['HOME', 'KIEZ', 'MARKT', 'CASINO']);
const INTENT_NAMES: ReadonlySet<string> = new Set([
  'SLEEP', 'WAKE_UP', 'EAT_HOME', 'EAT_OUT', 'WORK', 'LEISURE',
  'VISIT_FRIEND', 'SHOP', 'PUB', 'COMMUTE', 'IDLE',
]);

function containsResident(raw: unknown): raw is { residents: unknown[] } {
  return typeof raw === 'object' && raw !== null && Array.isArray((raw as { residents?: unknown }).residents);
}

function asNumber(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

/** Ein gespeicherter Bewohner; die Figur kommt aus der Besetzung. */
function restoreResident(
  record: Record<string, unknown>, npcId: string, seed: number,
  knownIds: readonly string[],
): CityResidentState | null {
  const def = rosterDefById(npcId, seed);
  if (!def) return null;
  const fresh: CityResidentState = {
    npcId,
    visitorId: null,
    name: def.name,
    role: def.role,
    location: 'HOME',
    position: { x: 8, y: 12 },
    travel: null,
    intent: 'SLEEP',
    needs: createDefaultNeeds(),
    attributes: { charisma: def.charisma, intellect: def.intellect },
    skills: defaultSkills(),
    relationships: {},
    memories: [],
    lastHour: 0,
    lastDay: 0,
  };
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
    ...fresh,
    visitorId: normalizeVisitorId(record.visitorId),
    name: text(record.name, def.name),
    role: text(record.role, def.role),
    location,
    intent,
    needs,
    position: normalizePosition(record.position, fresh.position),
    travel: normalizeTravel(record.travel),
    attributes: normalizeAttributes(record.attributes, fresh.attributes),
    skills: normalizeSkills(record.skills, fresh.skills),
    relationships: normalizeRelationships(record.relationships, npcId, knownIds),
    memories: normalizeMemories(record.memories),
    lastHour: asNumber(record.lastHour, fresh.lastHour, 0, 23),
    lastDay: asNumber(record.lastDay, fresh.lastDay, 0, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * Save-Migration: alte Saves ohne Stadtleben bekommen einen frischen,
 * deterministischen Startzustand; vorhandene Bewohner behalten ihre Werte.
 * Kennungen, deren Figur die Besetzung nicht kennt, werden verworfen.
 */
export function normalizeCityLife(raw: unknown): CityLifeState {
  if (!containsResident(raw)) return createCityLifeState();
  const source = raw as Record<string, unknown>;
  const seed = asNumber(source.seed, 0, 0, Number.MAX_SAFE_INTEGER);
  const entries = source.residents as unknown[];
  const ids = entries
    .map((entry) => (typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>).npcId : undefined))
    .filter((id): id is string => typeof id === 'string');
  const residents = entries
    .map((entry) => (typeof entry === 'object' && entry !== null
      ? restoreResident(entry as Record<string, unknown>,
        text((entry as Record<string, unknown>).npcId, ''), seed, ids)
      : null))
    .filter((resident): resident is CityResidentState => resident !== null);
  // Ein Save ohne lesbares Personal faellt auf die kuratierte Besetzung zurueck.
  if (residents.length < CITY_POPULATION_DEFAULT) return createCityLifeState(seed);
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
