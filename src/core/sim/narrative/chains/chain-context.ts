/** Baut den unveraenderlichen Ketten-Context aus Welt, Ledger und laufendem Knoten. */
import type { Ledger } from '../../../economy/ledger';
import type { InfluenceConfig, InfluenceValues } from '../../influence';
import { HAUSKONTO } from '../../money';
import type { WorldState } from '../../types';
import { rumorAbout } from '../knowledge-query';
import { relationshipBetween } from '../relationships';
import { visitorIdOf } from '../relationships';
import type { ActorRef } from '../types';
import type { ChainContext, ChainRun } from './chain-types';

const NEUTRAL: InfluenceValues = {
  mood: 50, sociability: 50, thirst: 0, rumor: 0, trust: 0, sympathy: 0, conflict: 0,
};

/** Liest die Faktoren eines Akteurs; fehlende Werte bleiben neutral, nie zufaellig. */
export function influenceValuesFor(world: WorldState, actor: ActorRef): InfluenceValues {
  const visitorId = visitorIdOf(actor);
  const guest = visitorId === null
    ? undefined
    : world.guests.find((entry) => entry.visitorId === visitorId && entry.state !== 'LEAVE');
  const edge = relationshipBetween(world, actor, 'player') ?? relationshipBetween(world, 'player', actor);
  return {
    mood: guest?.mood ?? NEUTRAL.mood,
    sociability: guest?.sociability ?? NEUTRAL.sociability,
    thirst: guest?.thirst ?? NEUTRAL.thirst,
    rumor: rumorAbout(world, actor),
    trust: edge?.trust ?? 0,
    sympathy: edge?.sympathy ?? 0,
    conflict: edge?.conflict ?? 0,
  };
}

export function chainContext(
  world: WorldState,
  ledger: Ledger,
  run: ChainRun,
  config: InfluenceConfig,
): ChainContext {
  const influenceByActor = new Map<ActorRef, InfluenceValues>();
  for (const actor of run.participants) influenceByActor.set(actor, influenceValuesFor(world, actor));
  const primary = run.participants[0];
  return {
    tick: world.tick,
    day: world.day,
    participants: [...run.participants],
    visits: run.visits,
    flags: { ...world.narrative.flags },
    relationships: [...world.narrative.relationships],
    knowledge: [...world.narrative.knowledge],
    recent: [...world.narrative.recent],
    events: [...world.narrative.events],
    houseBalance: ledger.getBalance(HAUSKONTO),
    reputation: world.reputation,
    influence: primary === undefined ? NEUTRAL : influenceByActor.get(primary) ?? NEUTRAL,
    influenceByActor,
    influenceConfig: config,
    lastChoiceId: run.lastChoiceId,
    lastOutcomeId: run.lastOutcomeId,
  };
}
