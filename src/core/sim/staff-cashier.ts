/** Kassierer: Fiat wechseln, Service quittieren und die Warteschlange weiterziehen. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { chooseActivity } from './guest-choice';
import { satisfyNeed } from './needs-core';
import { exchangeFiat, pendingAccount } from './money';
import type { StaffAgent, WorldState } from './types';
import { noteCashierService } from './desk-service';
import { exchangePoint } from './world';
import { dist, setTask, stepToward } from './staff-step';

export const CASHIER_WAIT = 12;

export function cashierTick(world: WorldState, ledger: Ledger, agent: StaffAgent, prng: Prng): void {
  const point = exchangePoint(world);
  if (!point) { setTask(agent, 'idle', 'keine Wechselkasse'); return; }
  const near = dist(agent.x, agent.y, point.x, point.y) <= 8;
  if (!near) { setTask(agent, 'toGuest', 'geht zur Kasse'); stepToward(world, agent, point.x, point.y); return; }
  setTask(agent, 'cashier');
  for (const guest of world.guests) {
    if (guest.state === 'EXCHANGE' && guest.queueIndex === 0) {
      try {
        exchangeFiat(ledger, guest.id, world.tick);
        noteCashierService(world, guest, agent);
      } catch {
        guest.patience = satisfyNeed(guest.patience, 2);
        continue;
      }
      chooseActivity(world, guest, ledger, prng);
    }
    if (guest.state === 'CASHOUT' && ledger.getBalance(pendingAccount(guest.id)) > 0) {
      guest.stateTicks = Math.max(guest.stateTicks, CASHIER_WAIT);
    }
  }
}
