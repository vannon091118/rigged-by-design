/** Wendet die fachlichen Beziehungsregeln auf bereits gedrainte Facts an. */
import type { WorldState } from '../types';
import { actorRefOfRival, actorRefOfVisitor, isStaffRef, shift, visitorIdOf } from './relationships';
import type { NarrativeFact } from './types';

const hasVisitor = (world: WorldState, id: number): boolean =>
  world.visitors.some((visitor) => visitor.id === id);

/**
 * Ein Fact kann mehrere gerichtete Kanten speisen; die Richtung bleibt Teil der
 * Bedeutung. Neutrale Begegnungen erzeugen keine Kante und pinnen niemanden.
 */
export function applyRelationshipFacts(world: WorldState, facts: readonly NarrativeFact[]): number {
  let applied = 0;
  for (const fact of facts) {
    if (fact.kind === 'VISIT_ENDED') {
      if (fact.valence === 'NEUTRAL' || !hasVisitor(world, fact.visitorId)) continue;
      shift(world, actorRefOfVisitor(fact.visitorId), 'player', fact.valence === 'GOOD'
        ? { trust: 2, sympathy: 2 }
        : { trust: -3, sympathy: -2 }, fact.tick);
      applied += 1;
      continue;
    }
    if (fact.kind === 'VISITOR_CONFLICT') {
      const first = visitorIdOf(fact.actorRefs[0] ?? 'player');
      const second = visitorIdOf(fact.actorRefs[1] ?? 'player');
      if (first === null || second === null || first === second
        || !hasVisitor(world, first) || !hasVisitor(world, second)) continue;
      const firstInitiated = fact.initiator === fact.actorRefs[0];
      if (!firstInitiated && fact.initiator !== fact.actorRefs[1]) continue;
      const initiator = firstInitiated ? first : second;
      const target = firstInitiated ? second : first;
      const weight = fact.severity;
      // Der Auslöser verliert weniger Vertrauen als die angegriffene Seite.
      shift(world, actorRefOfVisitor(initiator), actorRefOfVisitor(target),
        { trust: -2 * weight, sympathy: -1 * weight, conflict: 2 * weight }, fact.tick);
      shift(world, actorRefOfVisitor(target), actorRefOfVisitor(initiator),
        { trust: -3 * weight, sympathy: -2 * weight, conflict: 3 * weight }, fact.tick);
      applied += 1;
      continue;
    }
    if (fact.kind === 'VISITOR_SERVICE') {
      if (fact.valence === 'NEUTRAL') continue;
      const visitorRef = fact.actorRefs.find((ref) => visitorIdOf(ref) !== null);
      const staffRef = fact.actorRefs.find(isStaffRef);
      const visitorId = visitorRef ? visitorIdOf(visitorRef) : null;
      if (!visitorRef || !staffRef || visitorId === null || !hasVisitor(world, visitorId)) continue;
      shift(world, visitorRef, staffRef, fact.valence === 'GOOD'
        ? { trust: 1, sympathy: 1 }
        : { trust: -1, sympathy: -1, conflict: 1 }, fact.tick);
      applied += 1;
      continue;
    }
    if (fact.kind === 'RIVAL_ACTION') {
      const rivalRef = actorRefOfRival(fact.rivalId);
      if (fact.actorRefs.length !== 1 || fact.actorRefs[0] !== rivalRef || fact.action === 'PROBE') continue;
      // Die Richtung bleibt Rivale → Haus: das Haus ist Ziel, nicht Urheber.
      shift(world, rivalRef, 'player', fact.action === 'SABOTAGE'
        ? { conflict: 2, trust: -2 }
        : fact.action === 'TRADE_INFO' ? { trust: 1, sympathy: 1 } : { conflict: 1, influence: 1 }, fact.tick);
      applied += 1;
      continue;
    }
    if (fact.kind === 'RIVAL_ENCOUNTER') {
      if (fact.netToHouse === 0) continue;
      const rivalRef = actorRefOfRival(fact.rivalId);
      if (fact.actorRefs[0] !== rivalRef || fact.actorRefs[1] !== 'player') continue;
      shift(world, rivalRef, 'player', fact.netToHouse > 0
        ? { trust: -1, conflict: 1 }
        : { trust: 1, sympathy: 1 }, fact.tick);
      applied += 1;
    }
  }
  return applied;
}
