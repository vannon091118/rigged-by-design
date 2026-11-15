/**
 * Deterministische Beziehungstier, abgeleitet aus den kanonischen Kanten.
 *
 * Das Tier ist eine *Ableitung*, kein neuer Zustand: Die Kante in
 * `narrative.relationships` bleibt der einzige Besitzer der Werte. Das Tier
 * ist eine Schwellenentscheidung ueber Vertrauen/Sympathie/Konflikt, ohne
 * Writer und ohne Zufall (#802).
 *
 *   FREMDE     – noch keine Kante in dieser Richtung
 *   KONTAKT    – Kante vorhanden, aber noch schwach
 *   VERTRAUT   – Vertrauen >= 3 und Sympathie >= 1
 *   ANSPANNUNG – Konflikt >= 3 (Vorrang: aktive Anspannung wiegt warmer
 *                Zahlen ueber)
 */
import { cityOf } from '../city-model';
import type { WorldState } from '../types';
import { actorRefOfVisitor, relationshipBetween } from './relationships';
import type { ActorRef } from './types';
import type { EncounterAction } from '../city-types';

export type RelationshipTier = 'FREMDE' | 'KONTAKT' | 'VERTRAUT' | 'ANSPANNUNG';

const CONFLICT_AT = 3;
const TRUST_AT = 3;
const SYMPATHY_AT = 1;

export function relationshipTier(world: WorldState, from: ActorRef, to: ActorRef): RelationshipTier {
  const edge = relationshipBetween(world, from, to);
  if (!edge) return 'FREMDE';
  if (edge.conflict >= CONFLICT_AT) return 'ANSPANNUNG';
  if (edge.trust >= TRUST_AT && edge.sympathy >= SYMPATHY_AT) return 'VERTRAUT';
  return 'KONTAKT';
}

/**
 * Der Spieltext pro Tier: ein Satz, den ein NPC ueber den jetzigen Zustand
 * des Kontakts sagt. Leer fuer Fremde (dann steht die erste-Begegnung-Zeile).
 */
export const TIER_MEMORY_CLAUSE: Readonly<Record<RelationshipTier, string>> = {
  FREMDE: '',
  KONTAKT: ' Ihr kennt euch.',
  VERTRAUT: ' Die Distanz ist weitgehend weg.',
  ANSPANNUNG: ' Zwischen euch liegt etwas.',
};

export interface PlayerContact {
  /** Visitor-Kennung des NPC - derselbe Schluessel wie `lastEncounter`. */
  readonly npcVisitorId: number;
  /** Wie viele Begegnungen als Kontakte aufgezeichnet sind. */
  readonly met: number;
  readonly lastDay: number | null;
  readonly lastAction: EncounterAction | null;
  readonly tier: RelationshipTier;
}

/**
 * Die Kontakt-Registry als abgeleiteter Leser: Jede aufgezeichnete
 * Begegnung wird zum Kontakt, das Tier zeigt, wie dieser Kontakt steht.
 * Keiner neue persistente Zustand - die Aufzeichnung liegt schon in
 * `city.encounters`, die Kante in `narrative.relationships`.
 */
export function playerContact(world: WorldState, npcVisitorId: number): PlayerContact {
  const records = (cityOf(world).encounters ?? []).filter((entry) => entry.npcId === npcVisitorId);
  const last = records.length > 0 ? records[records.length - 1]! : null;
  return {
    npcVisitorId,
    met: records.length,
    lastDay: last?.day ?? null,
    lastAction: last?.action ?? null,
    tier: relationshipTier(world, actorRefOfVisitor(npcVisitorId), 'player'),
  };
}
