/**
 * Contract: actor-id v1.0
 * Dauerhafte Actor-ID und Referenzregeln.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type ActorId = string;

/** Präfixe für Actor-IDs, um Domänen-Trennung zu gewährleisten. */
export const ACTOR_ID_PREFIXES = Object.freeze({
  GUEST: 'guest_',
  RIVAL: 'rival_',
  VISITOR: 'visitor_',
  STAFF: 'staff_',
  PLAYER: 'player_',
} as const);

/** Erstellt eine validierte Actor-ID. Wirft bei ungültigem Format. */
export function createActorId(prefix: keyof typeof ACTOR_ID_PREFIXES, sequence: number): ActorId {
  const prefixValue = ACTOR_ID_PREFIXES[prefix];
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error(`actor-id: ungültige Sequenz ${sequence}`);
  }
  return `${prefixValue}${sequence}`;
}

/** Prüft, ob ein String eine syntaktisch gültige Actor-ID ist. */
export function isActorId(value: unknown): value is ActorId {
  if (typeof value !== 'string') return false;
  return Object.values(ACTOR_ID_PREFIXES).some((p) => value.startsWith(p));
}

/** Extrahiert den Präfix aus einer Actor-ID. */
export function actorIdPrefix(id: ActorId): keyof typeof ACTOR_ID_PREFIXES | null {
  for (const [key, prefix] of Object.entries(ACTOR_ID_PREFIXES)) {
    if (id.startsWith(prefix)) return key as keyof typeof ACTOR_ID_PREFIXES;
  }
  return null;
}
