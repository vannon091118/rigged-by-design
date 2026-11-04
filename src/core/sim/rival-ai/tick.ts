/** Ein Tick Rivalen-Denken: Eingaben aus der Welt, Absicht aus der reinen Politik. */
import { getRival, rivalState } from '../rivals';
import type { WorldState } from '../types';
import { applyRivalAction, sabotageTarget } from './actions';
import { decideRivalAction } from './policy';
import type { RivalActionRecord } from './types';

/** Nettofluss der letzten Begegnungen mit genau diesem Rivalen; positiv = Spielerhaus gewinnt. */
function recentNetToHouse(world: WorldState, rivalId: WorldState['rivals'][number]['rivalId']): number {
  let sum = 0;
  for (const fact of world.narrative.recent) {
    if (fact.kind === 'RIVAL_ENCOUNTER' && fact.rivalId === rivalId) sum += fact.netToHouse;
  }
  return sum;
}

/**
 * Laeuft vor der Narrative-Runtime, damit die RIVAL_ACTION-Facts im selben Tick
 * drainiert, beziehungswirksam und trigger-faehig werden.
 */
export function tickRivalMinds(world: WorldState): readonly RivalActionRecord[] {
  const acted: RivalActionRecord[] = [];
  const target = sabotageTarget(world);
  for (const mind of world.rivals) {
    const reputation = rivalState(getRival(mind.rivalId), world.tick).reputation;
    const plan = decideRivalAction({
      tick: world.tick,
      stance: mind.stance,
      capacity: mind.capacity,
      goodwill: mind.goodwill,
      nextActionTick: mind.nextActionTick,
      counteredUntilTick: mind.counteredUntilTick,
      rivalReputation: reputation,
      playerReputation: world.reputation,
      guestsServed: world.guestsServed,
      evidenceCount: mind.evidence.length,
      recentNetToHouse: recentNetToHouse(world, mind.rivalId),
      machineId: target,
    });
    if (plan) acted.push(applyRivalAction(world, mind, plan));
  }
  return acted;
}
