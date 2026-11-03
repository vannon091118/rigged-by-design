/** Baut aus Welt, Ledger und aktuellem Fact einen unveraenderlichen Trigger-Context. */
import type { Ledger } from '../../economy/ledger';
import { HAUSKONTO } from '../money';
import type { WorldState } from '../types';
import { actorRefOfVisitor } from './relationships';
import { NARRATIVE_LIMITS, type ActorRef, type NarrativeFact } from './types';
import type { TriggerContext } from './trigger-types';

/** Alte Visitor-Facts und neue actorRefs-Facts liefern dieselbe aufgeloeste Akteursliste. */
export function actorRefsOfFact(fact: NarrativeFact): readonly ActorRef[] {
  if ('actorRefs' in fact) return [...fact.actorRefs];
  if ('visitorId' in fact) return [actorRefOfVisitor(fact.visitorId)];
  return [];
}

/** Historie inklusive aktuellem Fact, dedupliziert und auf das Kurzzeitfenster begrenzt. */
function contextFacts(world: WorldState, fact: NarrativeFact): readonly NarrativeFact[] {
  const byId = new Map<number, NarrativeFact>();
  for (const entry of world.narrative.recent) byId.set(entry.id, entry);
  byId.set(fact.id, fact);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-(NARRATIVE_LIMITS.recent + 1));
}

export function buildTriggerContext(world: WorldState, ledger: Ledger, fact: NarrativeFact): TriggerContext {
  return {
    fact,
    facts: contextFacts(world, fact),
    tick: world.tick,
    day: world.day,
    flags: { ...world.narrative.flags },
    relationships: [...world.narrative.relationships],
    visitors: world.visitors,
    houseBalance: ledger.getBalance(HAUSKONTO),
    houseBand: world.narrative.houseBand,
    charismaLevel: world.player.rpg.charismaLevel,
    reputation: world.reputation,
    demandTier: world.demandTier,
    guestsServed: world.guestsServed,
    damagedDevice: world.furniture.some((item) => Boolean(item.gameId) && item.damaged),
  };
}
