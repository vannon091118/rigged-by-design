/**
 * @module social-encounter — Physische Begegnungen, soziale Wechselwirkungen und Oekonomie
 *
 * Eine Begegnung entsteht nur am gemeinsamen Ort in Reichweite; die Auswahl
 * steht in `selectSocialEncounter`, gebucht wird sie bei der Ankunft in
 * `city-life-movement`. Keine zweite Buchungsstelle.
 */

import type { ActorContinuityRecord } from './actor-continuity';
import { driftNeed, satisfyNeed } from './needs-core';

export const SOCIAL_INTERACTION_RADIUS = 2.5;

/**
 * Eine Begegnung ist ein Treffen am selben Ort, nicht eine Menge beliebig
 * vieler Personen auf derselben Kachel. Der Ankommende plus hoechstens zwei
 * Naechste bilden die Gruppe; weitere Anwesende bleiben Kulisse.
 */
export const SOCIAL_ENCOUNTER_CAPACITY = 3;

interface SocialEncounterCandidate {
  readonly npcId: string;
  readonly place: string;
  readonly position: { readonly x: number; readonly y: number };
}

interface SocialEncounterSelection {
  readonly partnerId: string;
  readonly distance: number;
  /** Ankommender zuerst, danach die naechsten Personen bis zur Kapazitaet. */
  readonly participantIds: readonly string[];
}

export interface SocialEncounterResult {
  readonly initiator: ActorContinuityRecord;
  readonly respondent: ActorContinuityRecord;
  readonly factDescription: string;
  readonly relationshipDelta: number;
}

export interface ServiceTransactionResult {
  readonly updatedCustomer: ActorContinuityRecord;
  readonly ledgerEntry: {
    readonly fromAccount: string;
    readonly toAccount: string;
    readonly amountMicro: number;
    readonly reason: string;
  };
}

export function canInitiateEncounter(
  p1: { readonly x: number; readonly y: number },
  p2: { readonly x: number; readonly y: number },
  maxDistance: number = SOCIAL_INTERACTION_RADIUS
): boolean {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy) <= maxDistance;
}

/**
 * Waehlt den naechsten nahen anwesenden Partner am selben Ort. Die Funktion ist die
 * eine Auswahlregel fuer Ankunft und bereits stehende Bewohner: gleicher Ort,
 * physische Naehe und eine feste Gruppengroesse. Ohne diese drei Bedingungen
 * gibt es keinen Kontakt; ein blosser Orts-Tag oder eine ferne Kachel genuegt
 * nicht.
 */
export function selectSocialEncounter(
  initiator: SocialEncounterCandidate,
  candidates: readonly SocialEncounterCandidate[],
  maxDistance: number = SOCIAL_INTERACTION_RADIUS,
  capacity: number = SOCIAL_ENCOUNTER_CAPACITY,
): SocialEncounterSelection | null {
  const maxParticipants = Math.max(2, Math.floor(capacity));
  const nearby = candidates
    .filter((candidate) => candidate.npcId !== initiator.npcId
      && candidate.place === initiator.place
      && canInitiateEncounter(initiator.position, candidate.position, maxDistance))
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(
        initiator.position.x - candidate.position.x,
        initiator.position.y - candidate.position.y,
      ),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, maxParticipants - 1);
  const partner = nearby[0];
  if (!partner) return null;
  return {
    partnerId: partner.candidate.npcId,
    distance: partner.distance,
    participantIds: [initiator.npcId, ...nearby.map((entry) => entry.candidate.npcId)],
  };
}

export function executeSocialConversation(
  initiator: ActorContinuityRecord,
  respondent: ActorContinuityRecord,
  topic: string = 'Alltag in der Stadt'
): SocialEncounterResult {
  const currentRel = initiator.relationships[respondent.actorId] ?? 0;
  const relationshipDelta = 10;
  const newRel = Math.min(100, Math.max(-100, currentRel + relationshipDelta));

  const updatedInitiator: ActorContinuityRecord = {
    ...initiator,
    needs: {
      ...initiator.needs,
      social: satisfyNeed(initiator.needs.social, 20),
      mood: driftNeed(initiator.needs.mood, 10),
    },
    relationships: {
      ...initiator.relationships,
      [respondent.actorId]: newRel,
    },
  };

  const updatedRespondent: ActorContinuityRecord = {
    ...respondent,
    needs: {
      ...respondent.needs,
      social: satisfyNeed(respondent.needs.social, 25),
      mood: driftNeed(respondent.needs.mood, 10),
    },
    relationships: {
      ...respondent.relationships,
      [initiator.actorId]: newRel,
    },
  };

  const factDescription = `Gespraech zwischen ${initiator.name} und ${respondent.name} ueber "${topic}" gefuehrt.`;

  return {
    initiator: updatedInitiator,
    respondent: updatedRespondent,
    factDescription,
    relationshipDelta,
  };
}

export function executeServiceTransaction(
  customer: ActorContinuityRecord,
  venueBuildingId: string,
  itemPriceMicro: number,
  itemKind: string
): ServiceTransactionResult {
  const finalPrice = Math.max(0, Math.round(itemPriceMicro));
  const newBalance = Math.max(0, customer.needs.money - finalPrice);

  const updatedCustomer: ActorContinuityRecord = {
    ...customer,
    needs: {
      ...customer.needs,
      money: newBalance,
      hunger: satisfyNeed(customer.needs.hunger, 30),
      mood: driftNeed(customer.needs.mood, 8),
    },
  };

  const ledgerEntry = {
    fromAccount: `actor:${customer.actorId}`,
    toAccount: `venue:${venueBuildingId}`,
    amountMicro: finalPrice,
    reason: `PURCHASE_${itemKind.toUpperCase()}`,
  };

  return {
    updatedCustomer,
    ledgerEntry,
  };
}
