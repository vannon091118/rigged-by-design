/** Kasse: Warteschlange, Bedienzeit und Wechsel von Fiat in Chips. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { chooseActivity, payAndLeave } from './guests';
import { exchangeFiat } from './money';
import type { Guest, WorldState } from './types';
import { exchangePoint } from './world';

/** Selbstbedienung dauert laenger; ein Kassierer am Schalter halbiert die Zeit pro Gast. */
export function deskServiceTicks(world: WorldState): number {
  const point = exchangePoint(world);
  const cashier = world.agents.find((agent) => agent.role === 'cashier');
  const staffed = !!point && !!cashier && Math.abs(cashier.x - point.x) + Math.abs(cashier.y - point.y) <= 8;
  return staffed ? 2 : 6;
}

/** Wechselt nur, wenn die Buchung vollstaendig gelingt; sonst bleibt das Fiat auf dem Gastkonto. */
export function arriveAtDesk(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): boolean {
  if (guest.queueIndex > 0) return false;
  try {
    exchangeFiat(ledger, guest.id, world.tick);
  } catch {
    guest.patience = Math.max(0, guest.patience - 2);
    world.lastEvent = `${guest.name} wartet an der Kasse.`;
    if (guest.patience === 0) payAndLeave(world, ledger, guest);
    return false;
  }
  chooseActivity(world, guest, ledger, prng);
  return true;
}

/** Weist jedem Gast in Warteschlange und Kasse eine eindeutige Position zu. */
export function exchangeQueue(world: WorldState): void {
  // Draussen und drinnen ist eine Schlange: wer zuerst da war, steht vorn.
  const queue = world.guests
    .filter((guest) => guest.state === 'EXCHANGE' || guest.state === 'ENTER')
    .sort((a, b) => a.id - b.id);
  queue.forEach((guest, index) => { guest.queueIndex = index; });
  const cashier = world.guests.filter((guest) => guest.state === 'CASHOUT').sort((a, b) => a.id - b.id);
  cashier.forEach((guest, index) => { guest.queueIndex = index; });
}
