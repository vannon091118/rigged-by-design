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
import type { CityTravel } from './city-life-movement';
import type { Point } from './types-model';
import { clamp, numberOr } from './num';

/** Weltkante der Stadt; Punkte ausserhalb sind kaputte Daten, kein Weg. */
const WORLD_LIMIT = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;


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
    charisma: clamp(Math.round(numberOr(raw.charisma, fallback.charisma)), 0, 10),
    intellect: clamp(Math.round(numberOr(raw.intellect, fallback.intellect)), 0, 10),
  };
}

export function normalizeSkills(raw: unknown, fallback: NpcSkills): NpcSkills {
  if (!isRecord(raw)) return fallback;
  return {
    cooking: clamp(Math.round(numberOr(raw.cooking, fallback.cooking)), 0, 100),
    work: clamp(Math.round(numberOr(raw.work, fallback.work)), 0, 100),
    social: clamp(Math.round(numberOr(raw.social, fallback.social)), 0, 100),
  };
}

export function normalizeRelationships(raw: unknown, npcId: string, ids: readonly string[]): Record<string, number> {
  if (!isRecord(raw)) return {};
  const relationships: Record<string, number> = {};
  for (const id of ids) {
    if (id === npcId || !(id in raw)) continue;
    const value = numberOr(raw[id], 0);
    relationships[id] = clamp(Math.round(value), -100, 100);
  }
  return relationships;
}

export function normalizeMemories(raw: unknown): NpcMemory[] {
  if (!Array.isArray(raw)) return [];
  const memories: NpcMemory[] = [];
  for (const item of raw.slice(-8)) {
    if (!isRecord(item) || typeof item.kind !== 'string' || !MEMORY_KINDS.has(item.kind)) continue;
    const id = Math.round(numberOr(item.id, 0));
    const tick = Math.round(numberOr(item.tick, 0));
    if (id <= 0 || tick < 0) continue;
    const about = typeof item.aboutNpcId === 'string' && item.aboutNpcId.length > 0 ? item.aboutNpcId : null;
    memories.push({
      id, tick, kind: item.kind as NpcMemory['kind'], aboutNpcId: about,
      sentiment: clamp(numberOr(item.sentiment, 0), -1, 1),
      confidence: clamp(numberOr(item.confidence, 0), 0, 1),
    });
  }
  return memories;
}

/** Kennung des Profils: positive Ganzzahl oder `null` (wird beim Laden gebunden). */
export function normalizeVisitorId(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const id = Math.round(raw);
  return id > 0 ? id : null;
}

/** Kachel im Stadtmass; fehlende oder kaputte Positionen fallen auf den Start. */
export function normalizePosition(raw: unknown, fallback: Point): Point {
  if (!isRecord(raw)) return fallback;
  const x = Math.round(numberOr(raw.x, -1));
  const y = Math.round(numberOr(raw.y, -1));
  if (x < 0 || y < 0 || x >= WORLD_LIMIT || y >= WORLD_LIMIT) return fallback;
  return { x, y };
}

/** Ein gespeicherter Weg gilt nur vollstaendig; sonst steht der Bewohner still. */
export function normalizeTravel(raw: unknown): CityTravel | null {
  if (!isRecord(raw)) return null;
  const to = raw.to;
  if (to !== 'HOME' && to !== 'KIEZ' && to !== 'MARKT' && to !== 'CASINO') return null;
  if (!Array.isArray(raw.path) || raw.path.length < 2) return null;
  const path: Point[] = [];
  for (const entry of raw.path) {
    if (!isRecord(entry)) return null;
    const x = Math.round(numberOr(entry.x, -1));
    const y = Math.round(numberOr(entry.y, -1));
    if (x < 0 || y < 0 || x >= WORLD_LIMIT || y >= WORLD_LIMIT) return null;
    path.push({ x, y });
  }
  const index = Math.round(numberOr(raw.index, 0));
  if (index < 0 || index >= path.length) return null;
  return { to, path, index };
}

/** Der Trace ist Lauf-Ausgabe, kein zweiter Spielzustand; alte Saves starten leer. */
export function normalizeLastDecisions(raw: unknown): CityLifeState['lastDecisions'] {
  return Array.isArray(raw) ? [] : [];
}
