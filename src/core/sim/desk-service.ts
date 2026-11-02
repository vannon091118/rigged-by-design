/** Kasse: Warteschlange, Bedienzeit und Wechsel von Fiat in Chips. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { chooseActivity, payAndLeave } from './guests';
import { exchangeFiat } from './money';
import { emitFact } from './narrative/facts';
import { actorRefOfStaff, actorRefOfVisitor } from './narrative/relationships';
import type { Guest, StaffAgent, WorldState } from './types';
import { exchangePoint } from './world';

/** Der tatsaechlich an der Wechselkasse stehende Kassierer; Selbstbedienung hat keinen. */
function cashierAtDesk(world: WorldState): StaffAgent | null {
  const point = exchangePoint(world);
  if (!point) return null;
  return world.agents.find((agent) => agent.role === 'cashier'
    && Math.abs(agent.x - point.x) + Math.abs(agent.y - point.y) <= 8) ?? null;
}

/** Eine echte Servicebegegnung: der Gast wird vom anwesenden Personal bedient. */
export function noteCashierService(world: WorldState, guest: Guest, agent: StaffAgent): void {
  if (guest.visitorId === undefined) return;
  emitFact(world, {
    kind: 'VISITOR_SERVICE',
    actorRefs: [actorRefOfVisitor(guest.visitorId), actorRefOfStaff(agent.id)],
    service: 'CASHIER', valence: 'GOOD',
  });
}

/** Selbstbedienung dauert laenger; ein Kassierer am Schalter halbiert die Zeit pro Gast. */
export function deskServiceTicks(world: WorldState): number {
  return cashierAtDesk(world) ? 2 : 6;
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
  const cashier = cashierAtDesk(world);
  if (cashier) noteCashierService(world, guest, cashier);
  chooseActivity(world, guest, ledger, prng);
  return true;
}

/**
 * Weist jedem Gast an der Kasse eine eindeutige Position zu. Beide Gruppen
 * zaehlen in derselben Rangfolge weiter: wer wechselt, steht vorn, wer seine
 * Auszahlung abholt, dahinter. Zwei Gruppen auf demselben Fleck war der Fehler.
 */
export function exchangeQueue(world: WorldState): void {
  // Draussen und drinnen ist eine Schlange: wer zuerst da war, steht vorn.
  const queue = world.guests
    .filter((guest) => guest.state === 'EXCHANGE' || guest.state === 'ENTER')
    .sort((a, b) => a.id - b.id);
  queue.forEach((guest, index) => { guest.queueIndex = index; });
  const cashier = world.guests.filter((guest) => guest.state === 'CASHOUT').sort((a, b) => a.id - b.id);
  cashier.forEach((guest, index) => { guest.queueIndex = queue.length + index; });
}
