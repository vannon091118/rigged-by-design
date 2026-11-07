/**
 * Contract: relationship v1.0
 * Gerichtete Relationship-IDs und erlaubte Änderungsbefehle.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

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

/** Erstellt eine neue Relationship-Kante. Wirft bei ungültigen IDs. */
export function createRelationshipEdge(
  sourceActorId: ActorId,
  targetActorId: ActorId,
  relationshipType: RelationshipType,
): RelationshipEdge {
  if (!sourceActorId || !targetActorId || !relationshipType) {
    throw new Error('relationship: sourceActorId, targetActorId und relationshipType dürfen nicht leer sein');
  }
  if (sourceActorId === targetActorId) {
    throw new Error('relationship: Quelle und Ziel müssen verschieden sein');
  }
  return {
    edgeId: `${sourceActorId}->${targetActorId}:${relationshipType}`,
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
  if (!edge.edgeId || typeof edge.edgeId !== 'string') return false;
  if (!edge.sourceActorId || typeof edge.sourceActorId !== 'string') return false;
  if (!edge.targetActorId || typeof edge.targetActorId !== 'string') return false;
  if (!edge.relationshipType || typeof edge.relationshipType !== 'string') return false;
  if (typeof edge.stance !== 'number' || edge.stance < -100 || edge.stance > 100) return false;
  if (typeof edge.goodwill !== 'number' || edge.goodwill < 0 || edge.goodwill > 100) return false;
  if (!Array.isArray(edge.history) || edge.history.length > 6) return false;
  if (!Array.isArray(edge.clues) || edge.clues.length > 4) return false;
  return true;
}
