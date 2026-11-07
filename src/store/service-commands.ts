/** Service Commands: Gäste bedienen, Bezahlen, Bewegen. */
import type { Ledger } from '../core/economy/ledger';
import { payGuest } from '../core/sim/service-actions';
import { takeDrink, serveDrink, movePlayer } from '../core/sim/player';
import type { Point } from '../core/sim/types';
import type { WorldState } from '../core/sim/types';

export function takeDrinkCmd(world: WorldState): string {
  takeDrink(world);
  return world.lastEvent;
}

export function serveDrinkCmd(world: WorldState, ledger: Ledger, guestId: number): string {
  serveDrink(world, ledger, guestId);
  return world.lastEvent;
}

export function moveToCmd(world: WorldState, point: Point): void {
  movePlayer(world, point);
}

export function payCmd(world: WorldState, ledger: Ledger, guestId: number): string {
  const paid = payGuest(world, ledger, guestId, world.tick);
  return paid > 0 ? `Ausgezahlt.` : 'Keine offene Auszahlung.';
}
