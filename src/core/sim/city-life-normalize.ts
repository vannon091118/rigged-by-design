/**
 * @module city-life-normalize — sichere Defaults und Save-Migration der NPC-Stats
 *
 * Alte Saves kennen weder Attribute, Faehigkeiten, Beziehungen noch
 * Erinnerungen. Jedes fehlende Feld bekommt einen erklaerbaren Startwert; ein
 * kaputter Wert wird nicht in die Simulation getragen.
 */
import type {
  NpcAttributes, NpcMemory, NpcSkills, CityLifeState,
} from './city-life-types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const number = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const MEMORY_KINDS = new Set(['MEAL', 'SOCIAL', 'RUMOR', 'WORK']);

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/** Seedfeste Startabweichung; Seed 0 laesst die kuratierten Werte unveraendert. */
export function seedOffset(seed: number, npcId: string, key: string): number {
  if (seed === 0) return 0;
  return (hash(`${seed}:${npcId}:${key}`) % 5) - 2;
}

export const defaultSkills = (): NpcSkills => ({ cooking: 20, work: 10, social: 20 });

export function normalizeAttributes(raw: unknown, fallback: NpcAttributes): NpcAttributes {
  if (!isRecord(raw)) return fallback;
  return {
    charisma: clamp(Math.round(number(raw.charisma, fallback.charisma)), 0, 10),
    intellect: clamp(Math.round(number(raw.intellect, fallback.intellect)), 0, 10),
  };
}

export function normalizeSkills(raw: unknown, fallback: NpcSkills): NpcSkills {
  if (!isRecord(raw)) return fallback;
  return {
    cooking: clamp(Math.round(number(raw.cooking, fallback.cooking)), 0, 100),
    work: clamp(Math.round(number(raw.work, fallback.work)), 0, 100),
    social: clamp(Math.round(number(raw.social, fallback.social)), 0, 100),
  };
}

export function normalizeRelationships(raw: unknown, npcId: string, ids: readonly string[]): Record<string, number> {
  if (!isRecord(raw)) return {};
  const relationships: Record<string, number> = {};
  for (const id of ids) {
    if (id === npcId || !(id in raw)) continue;
    const value = number(raw[id], 0);
    relationships[id] = clamp(Math.round(value), -100, 100);
  }
  return relationships;
}

export function normalizeMemories(raw: unknown): NpcMemory[] {
  if (!Array.isArray(raw)) return [];
  const memories: NpcMemory[] = [];
  for (const item of raw.slice(-8)) {
    if (!isRecord(item) || typeof item.kind !== 'string' || !MEMORY_KINDS.has(item.kind)) continue;
    const id = Math.round(number(item.id, 0));
    const tick = Math.round(number(item.tick, 0));
    if (id <= 0 || tick < 0) continue;
    const about = typeof item.aboutNpcId === 'string' && item.aboutNpcId.length > 0 ? item.aboutNpcId : null;
    memories.push({
      id, tick, kind: item.kind as NpcMemory['kind'], aboutNpcId: about,
      sentiment: clamp(number(item.sentiment, 0), -1, 1),
      confidence: clamp(number(item.confidence, 0), 0, 1),
    });
  }
  return memories;
}

/** Der Trace ist Lauf-Ausgabe, kein zweiter Spielzustand; alte Saves starten leer. */
export function normalizeLastDecisions(raw: unknown): CityLifeState['lastDecisions'] {
  return Array.isArray(raw) ? [] : [];
}
