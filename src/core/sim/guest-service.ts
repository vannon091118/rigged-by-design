/** Gast verlässt den Floor, wird wütend und wird ausgezahlt. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC } from '../economy/vacoin';
import { recordJournal } from './journal';
import { closeFiat, exchangeFromVc, guestAccount, payPending } from './money';
import type { Furniture, Guest, WorldState } from './types';
import { furnitureById, releaseSeat, sendGuest } from './world';

export function becomeAngry(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.state = 'ANGRY';
  guest.stateTicks = 0;
  guest.anger = 100;
  guest.targetFurniture = 0;
  guest.intent = 'Geduld aufgebraucht: randaliert.';
  world.lastEvent = `${guest.name} ist wütend.`;
  recordJournal(world, {
    kind: 'GUEST', subject: guest.name, cause: 'Geduld aufgebraucht', effect: world.lastEvent,
    refs: { guestId: guest.id },
  });
}

export function leave(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.targetFurniture = 0;
  guest.state = 'LEAVE';
  guest.stateTicks = 0;
  guest.intent = guest.intent ?? 'Besuch beendet: verlaesst das Casino.';
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE');
  if (entrance) sendGuest(world, guest, { x: entrance.x + 1, y: entrance.y + Math.floor(entrance.h / 2) });
  else guest.path = [];
}

/** Erst alle Ansprueche buchen, dann gehen: ein Fehlschlag laesst Gast und Guthaben stehen. */
export function payAndLeave(world: WorldState, ledger: Ledger, guest: Guest): void {
  try {
    payPending(ledger, guest.id, world.tick);
    const balance = ledger.getBalance(guestAccount(guest.id));
    if (balance > ZERO_VC) exchangeFromVc(ledger, guest.id, balance, world.tick);
    closeFiat(ledger, guest.id, world.tick);
    world.guestsServed += 1;
    recordJournal(world, {
      kind: 'GUEST', subject: guest.name, cause: 'Besuch beendet', effect: 'Auszahlung abgeschlossen, Gast verlaesst den Floor.',
      refs: { guestId: guest.id },
    });
  } catch {
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    guest.path = [];
    guest.pathIndex = 0;
    guest.intent = 'Auszahlung nicht gedeckt: wartet an der Kasse.';
    world.lastEvent = `${guest.name} wartet auf die Auszahlung.`;
    return;
  }
  leave(world, guest);
}

export function targetedFurniture(world: WorldState, guest: Guest): Furniture | null {
  return furnitureById(world, guest.targetFurniture);
}
