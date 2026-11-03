/** Service Commands: Gäste bedienen, Bezahlen, Bewegen. */
import type { Ledger } from '../core/economy/ledger';
import { payGuest } from '../core/sim/service-actions';
import { takeDrink, serveDrink, movePlayer } from '../core/sim/player';
import type { Point } from '../core/sim/types';
import type { WorldState } from '../core/sim/types';
import { guestById } from '../core/sim/world';
import { emitFact } from '../core/sim/narrative/facts';
import { actorRefOfVisitor } from '../core/sim/narrative/relationships';

export function takeDrinkCmd(world: WorldState): string {
  takeDrink(world);
  return world.lastEvent;
}

export function serveDrinkCmd(world: WorldState, ledger: Ledger, guestId: number): string {
  serveDrink(world, ledger, guestId);
  const g = guestById(world, guestId);
  if (g?.visitorId) emitFact(world, { kind: 'VISITOR_SERVICE', actorRefs: [actorRefOfVisitor(g.visitorId)], initiator: actorRefOfVisitor(g.visitorId), severity: 1 });
  return world.lastEvent;
}

export function moveToCmd(world: WorldState, point: Point): void {
  movePlayer(world, point);
}

export function payCmd(world: WorldState, ledger: Ledger, guestId: number): string {
  const paid = payGuest(world, ledger, guestId, world.tick);
  return paid > 0 ? `Ausgezahlt.` : 'Keine offene Auszahlung.';
}
