/** Kanonische, gerichtete Beziehungen zwischen persistenten Akteuren. */
import type { RivalId, WorldState } from '../types';
import { NARRATIVE_LIMITS, type ActorRef, type RelationshipEdge } from './types';

const DIMENSION_MIN = -10;
const DIMENSION_MAX = 10;
const VISITOR_REF = /^visitor:([1-9]\d*)$/;
const STAFF_REF = /^staff:([1-9]\d*)$/;
const RIVAL_REF = /^rival:[A-Z_]+$/;

export const actorRefOfVisitor = (id: number): ActorRef => `visitor:${id}`;
export const actorRefOfStaff = (id: number): ActorRef => `staff:${id}`;
export const actorRefOfRival = (id: RivalId): ActorRef => `rival:${id}`;

export function isActorRef(value: unknown): value is ActorRef {
  return value === 'player'
    || (typeof value === 'string' && (VISITOR_REF.test(value) || STAFF_REF.test(value) || RIVAL_REF.test(value)));
}

export const isStaffRef = (value: ActorRef): boolean => STAFF_REF.test(value);

export function visitorIdOf(ref: ActorRef): number | null {
  const match = VISITOR_REF.exec(ref);
  return match ? Number(match[1]) : null;
}

function relationshipKey(from: ActorRef, to: ActorRef): string {
  return `${from}>${to}`;
}

export function relationshipBetween(world: WorldState, from: ActorRef, to: ActorRef): RelationshipEdge | null {
  return world.narrative.relationships.find((edge) => edge.from === from && edge.to === to) ?? null;
}

const clamp = (value: number): number => Math.max(DIMENSION_MIN, Math.min(DIMENSION_MAX, value));
const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
/** Der Writer prueft dieselbe Endlichkeit wie die Normalisierung: kein NaN im Zustand. */
const delta = (value: unknown): number => finite(value);
const safeTick = (value: unknown): number => {
  const tick = finite(value);
  return Number.isSafeInteger(tick) && tick >= 0 ? tick : 0;
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

type RelationshipShift = Partial<Pick<RelationshipEdge, 'trust' | 'sympathy' | 'conflict' | 'influence'>>;

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Stabile kanonische Reihenfolge: aelteste zuerst, Gleichstand nach Akteurspaar. */
const compareEdges = (a: RelationshipEdge, b: RelationshipEdge): number =>
  a.updatedTick - b.updatedTick || compareText(a.from, b.from) || compareText(a.to, b.to);

/** Genau eine Kante je Richtung; die Kante bleibt der einzige Besitzer der Werte. */
export function shift(world: WorldState, from: ActorRef, to: ActorRef, changes: RelationshipShift, tick: number): void {
  // Dieselbe Invariante wie normalizeRelationships: eine Kante hat zwei verschiedene Enden.
  if (from === to) return;
  const key = relationshipKey(from, to);
  const list = world.narrative.relationships;
  const index = list.findIndex((edge) => relationshipKey(edge.from, edge.to) === key);
  if (index < 0) {
    list.push({
      from, to,
      trust: clamp(delta(changes.trust)),
      sympathy: clamp(delta(changes.sympathy)),
      conflict: clamp(delta(changes.conflict)),
      influence: clamp(delta(changes.influence)),
      updatedTick: safeTick(tick),
    });
  } else {
    const edge = list[index]!;
    list[index] = {
      ...edge,
      trust: clamp(edge.trust + delta(changes.trust)),
      sympathy: clamp(edge.sympathy + delta(changes.sympathy)),
      conflict: clamp(edge.conflict + delta(changes.conflict)),
      influence: clamp(edge.influence + delta(changes.influence)),
      updatedTick: safeTick(tick),
    };
  }
  list.sort(compareEdges);
  if (list.length > NARRATIVE_LIMITS.relationships) {
    list.splice(0, list.length - NARRATIVE_LIMITS.relationships);
  }
}

/** Alle Visitor-IDs mit mindestens einer Kante; Retention darf sie nicht loeschen. */
export function pinnedVisitorIds(world: WorldState): ReadonlySet<number> {
  const pinned = new Set<number>();
  for (const edge of world.narrative.relationships) {
    const from = visitorIdOf(edge.from);
    const to = visitorIdOf(edge.to);
    if (from !== null) pinned.add(from);
    if (to !== null) pinned.add(to);
  }
  return pinned;
}

/**
 * Ruf, der aus Beziehungen entsteht: wie die Leute ueber das Haus sprechen,
 * wenn sie an den Spieler denken. Nur Kanten zum Spieler zaehlen; Vertrauen und
 * Sympathie heben, Konflikt senkt. Der Anteil ist auf +-6 Punkte begrenzt,
 * damit der Ruf nicht an einer Kante haengt und die uebrigen Quellen sichtbar
 * bleiben. Kein Zufall, keine zweite Ruf-Wahrheit: `reputation()` bleibt der
 * einzige Leser.
 */
const RELATIONSHIP_REPUTATION_LIMIT = 6;

export function relationshipStanding(world: WorldState): number {
  let sum = 0;
  for (const edge of world.narrative.relationships) {
    if (edge.to !== 'player') continue;
    sum += edge.trust * 0.6 + edge.sympathy * 0.4 - edge.conflict * 0.8;
  }
  const scaled = sum / 6;
  return Math.max(-RELATIONSHIP_REPUTATION_LIMIT, Math.min(RELATIONSHIP_REPUTATION_LIMIT, scaled));
}

/** Verwirft kaputte Kanten, begrenzt Dimensionen und haelt die Anzahl im Budget. */
export function normalizeRelationships(raw: unknown): RelationshipEdge[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, RelationshipEdge>();
  for (const entry of raw) {
    if (!isRecord(entry) || !isActorRef(entry.from) || !isActorRef(entry.to) || entry.from === entry.to) continue;
    const edge: RelationshipEdge = {
      from: entry.from,
      to: entry.to,
      trust: clamp(finite(entry.trust)),
      sympathy: clamp(finite(entry.sympathy)),
      conflict: clamp(finite(entry.conflict)),
      influence: clamp(finite(entry.influence)),
      updatedTick: safeTick(entry.updatedTick),
    };
    const key = relationshipKey(edge.from, edge.to);
    if (!byKey.has(key)) byKey.set(key, edge);
  }
  return [...byKey.values()].sort(compareEdges).slice(-NARRATIVE_LIMITS.relationships);
}
