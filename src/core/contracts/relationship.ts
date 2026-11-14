/**
 * Contract: relationship v1.0
 * Gerichtete Relationship-IDs und erlaubte Änderungsbefehle.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

import { isActorId } from './actor-id';

export type RelationshipId = string;
export type ActorId = string;
export type RelationshipType = string;

/** Ein gerichteter Relationship-Edge. */
export interface RelationshipEdge {
  readonly edgeId: RelationshipId;
  readonly sourceActorId: ActorId;
  readonly targetActorId: ActorId;
  readonly relationshipType: RelationshipType;
  readonly stance: number; // -100 (feindlich) bis +100 (freundlich)
  readonly goodwill: number; // 0 bis 100
  readonly history: readonly string[]; // max 6 Einträge
  readonly clues: readonly string[]; // max 4 Einträge
}

const STANCE_MIN = -100;
const STANCE_MAX = 100;
const GOODWILL_MIN = 0;
const GOODWILL_MAX = 100;
const HISTORY_MAX = 6;
const CLUES_MAX = 4;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isFiniteWithin = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const isTextList = (value: unknown, maxLength: number): value is readonly string[] =>
  Array.isArray(value) && value.length <= maxLength && value.every((entry: unknown) => typeof entry === 'string');

const relationshipEdgeId = (
  sourceActorId: ActorId,
  targetActorId: ActorId,
  relationshipType: RelationshipType,
): RelationshipId => `${sourceActorId}->${targetActorId}:${relationshipType}`;

/** Erstellt eine neue Relationship-Kante. Wirft bei ungültigen IDs. */
export function createRelationshipEdge(
  sourceActorId: ActorId,
  targetActorId: ActorId,
  relationshipType: RelationshipType,
): RelationshipEdge {
  if (!isActorId(sourceActorId)) {
    throw new Error('relationship: sourceActorId ist keine gültige Actor-ID');
  }
  if (!isActorId(targetActorId)) {
    throw new Error('relationship: targetActorId ist keine gültige Actor-ID');
  }
  if (!isNonEmptyString(relationshipType)) {
    throw new Error('relationship: relationshipType darf nicht leer sein');
  }
  if (sourceActorId === targetActorId) {
    throw new Error('relationship: Quelle und Ziel müssen verschieden sein');
  }
  return {
    edgeId: relationshipEdgeId(sourceActorId, targetActorId, relationshipType),
    sourceActorId,
    targetActorId,
    relationshipType,
    stance: 0,
    goodwill: 50,
    history: [],
    clues: [],
  };
}

/** Prüft, ob eine Relationship-Kante die Invarianten erfüllt. */
export function validateRelationshipEdge(edge: RelationshipEdge): boolean {
  if (typeof edge !== 'object' || edge === null) return false;
  if (!isActorId(edge.sourceActorId) || !isActorId(edge.targetActorId)) return false;
  if (edge.sourceActorId === edge.targetActorId) return false;
  if (!isNonEmptyString(edge.relationshipType)) return false;
  if (edge.edgeId !== relationshipEdgeId(edge.sourceActorId, edge.targetActorId, edge.relationshipType)) {
    return false;
  }
  if (!isFiniteWithin(edge.stance, STANCE_MIN, STANCE_MAX)) return false;
  if (!isFiniteWithin(edge.goodwill, GOODWILL_MIN, GOODWILL_MAX)) return false;
  return isTextList(edge.history, HISTORY_MAX) && isTextList(edge.clues, CLUES_MAX);
}
