/** Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { TICKS_PER_DAY, tickDemand } from './demand';
import { maybeStartBrawl, tickDisputes } from './disputes';
import { dirtyNear } from './emotion';
import { tickPenaltyDays } from './penalty-pool';
import { actAtTarget, becomeAngry, chooseActivity, moveGuest, payAndLeave, releaseAndChoose } from './guests';
import { exchangeFiat, guestAccount, HAUSKONTO, pendingAccount, STAFF, UTILITIES } from './money';
import { tickNeeds } from './needs';
import { reputation } from './spawn';
import { CASHIER_WAIT, tickAgents } from './staff';
import type { Guest, WorldState } from './types';
import { exchangePoint, furnitureById, sendGuest } from './world';

/** Wechselt nur, wenn die Buchung vollstaendig gelingt; sonst bleibt das Fiat auf dem Gastkonto. */
function arriveAtDesk(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): boolean {
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

function angerTick(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): void {
  guest.stateTicks += 1;
  if (guest.stateTicks === 1) {
    const candidates = world.furniture.filter((item) => item.kind !== 'EXCHANGE');
    const target = candidates[prng.nextInt(0, Math.max(0, candidates.length - 1))];
    const guard = world.staff.guard;
    if (target && prng.nextFloat() < (guard ? 0.16 : 0.72)) {
      const damage = 8 + prng.nextInt(0, 24);
      target.condition = Math.max(0, target.condition - damage);
      target.damaged = true;
      world.dirty.add((target.y + 1) * world.size + target.x + 1);
      world.lastEvent = `${guest.name} hat ${target.label} beschädigt.`;
    } else {
      world.lastEvent = guard ? 'Der Guard hat Schlimmeres verhindert.' : `${guest.name} tobt, aber nichts geht kaputt.`;
    }
  }
  if (guest.stateTicks > 4) {
    if (ledger.getBalance(guestAccount(guest.id)) > ZERO_VC || ledger.getBalance(`PENDING_${guest.id}`) > ZERO_VC) {
      const desk = exchangePoint(world);
      if (desk) { guest.state = 'CASHOUT'; guest.stateTicks = 0; guest.path = []; sendGuest(world, guest, desk); return; }
    }
    payAndLeave(world, ledger, guest);
  }
}

function exchangeQueue(world: WorldState): void {
  const queue = world.guests.filter((guest) => guest.state === 'EXCHANGE').sort((a, b) => a.id - b.id);
  queue.forEach((guest, index) => { guest.queueIndex = index; });
  const cashier = world.guests.filter((guest) => guest.state === 'CASHOUT').sort((a, b) => a.id - b.id);
  cashier.forEach((guest, index) => { guest.queueIndex = index; });
}

function guestTick(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): void {
  if (guest.state === 'ENTER') {
    const point = exchangePoint(world);
    if (!point) return;
    if (guest.path.length === 0) sendGuest(world, guest, point);
    if (moveGuest(guest)) { guest.state = 'EXCHANGE'; guest.stateTicks = 0; }
    return;
  }
  if (guest.state === 'EXCHANGE') {
    if (guest.queueIndex > 0) {
      guest.patience = Math.max(0, guest.patience - 0.35);
      guest.mood = Math.max(0, guest.mood - 0.05);
      if (guest.patience <= 0) { payAndLeave(world, ledger, guest); return; }
    }
    periodDelay(guest);
    if (guest.stateTicks < 2) return;
    arriveAtDesk(world, ledger, prng, guest);
    return;
  }
  if (guest.state === 'CHOOSE') { chooseActivity(world, guest, ledger, prng); return; }
  // Lounge-Warten hat kein Moebelziel und darf nicht jede Tick neu wuerfeln.
  if (guest.state === 'WAIT' && guest.targetFurniture === 0) {
    if (!moveGuest(guest)) return;
    guest.stateTicks += 1;
    if (guest.stateTicks > 3) { releaseAndChoose(world, guest); chooseActivity(world, guest, ledger, prng); }
    return;
  }
  if (guest.state === 'PLAY' || guest.state === 'DRINK' || guest.state === 'TOILET' || guest.state === 'WAIT') {
    if (!moveGuest(guest)) return;
    const item = furnitureById(world, guest.targetFurniture);
    if (!item) { releaseAndChoose(world, guest); return; }
    actAtTarget(world, ledger, prng, guest, item);
    return;
  }
  if (guest.state === 'CASHOUT') {
    const point = exchangePoint(world);
    if (!point) { payAndLeave(world, ledger, guest); return; }
    if (guest.path.length === 0) sendGuest(world, guest, point);
    if (!moveGuest(guest)) return;
    const cashier = world.agents.find((agent) => agent.role === 'cashier');
    if (cashier && Math.abs(cashier.x - point.x) + Math.abs(cashier.y - point.y) <= 8) {
      guest.stateTicks = Math.max(guest.stateTicks, CASHIER_WAIT);
    }
    if (ledger.getBalance(pendingAccount(guest.id)) > ZERO_VC && guest.stateTicks < CASHIER_WAIT) {
      guest.stateTicks += 1;
      guest.patience = Math.max(0, guest.patience - 1);
      return;
    }
    payAndLeave(world, ledger, guest);
    return;
  }
  if (guest.state === 'LEAVE') {
    if (moveGuest(guest)) world.guests = world.guests.filter((entry) => entry.id !== guest.id);
    return;
  }
  if (guest.state === 'ANGRY') angerTick(world, ledger, prng, guest);
}

function periodDelay(guest: Guest): void {
  guest.stateTicks += 1;
}

function staffTick(world: WorldState, ledger: Ledger): void {
  if (world.staff.cleaner && world.dirty.size > 0 && world.tick % 4 === 0) {
    const first = [...world.dirty][0];
    if (first !== undefined) world.dirty.delete(first);
  }
  if (world.tick % TICKS_PER_DAY !== 0) return;
  world.day += 1;
  tickPenaltyDays(world);
  const wages = ((world.staff.guard ? world.prices.guardWage : 0)
    + (world.staff.cleaner ? world.prices.staffWage : 0)
    + (world.staff.bartender ? world.prices.staffWage : 0)
    + (world.staff.cashier ? world.prices.cashierWage : 0)
    + (world.staff.porter ? world.prices.porterWage : 0)) as VaCoinMicro;
  const rent = (world.prices.cleaningCost * 2) as VaCoinMicro;
  try {
    if (wages > 0) ledger.transfer(HAUSKONTO, STAFF, wages, 'personal', world.tick);
    ledger.transfer(HAUSKONTO, UTILITIES, rent, 'miete und strom', world.tick);
    world.lastEvent = `Tag ${world.day}. Löhne und Miete bezahlt.`;
  } catch {
    world.lastEvent = `Tag ${world.day}. Die Kasse reicht nicht für Löhne und Miete.`;
  }
}

/** Alte Saves und abgebrochene Gastpfade duerfen keinen Sitz dauerhaft blockieren. */
function releaseOrphanSeats(world: WorldState): void {
  const present = new Set(world.guests.map((guest) => guest.id));
  for (const item of world.furniture) {
    if (!item.occupants.every((id) => present.has(id))) {
      item.occupants = item.occupants.filter((id) => present.has(id));
    }
  }
}

function decay(world: WorldState): void {
  const dirty = world.dirty;
  for (const guest of world.guests) {
    if (guest.state !== 'LEAVE') tickNeeds(world, guest);
    if (guest.state === 'ANGRY') continue;
    const spotted = dirtyNear(dirty, world.size, guest.position.x, guest.position.y, 2);
    if (spotted) {
      guest.mood = Math.max(0, guest.mood - 0.12);
      guest.patience = Math.max(0, guest.patience - 0.06);
    } else {
      guest.mood = Math.min(100, guest.mood + 0.03);
      guest.patience = Math.min(100, guest.patience + 0.02);
    }
    if (guest.state === 'CHOOSE' || guest.state === 'WAIT') guest.mood = Math.max(0, guest.mood - 0.04);
    // Wer schon geht oder ausgezahlt wird, randaliert nicht mehr; sonst dreht der Gast endlos zwischen ANGRY und CASHOUT.
    if (guest.mood < 20 && guest.state !== 'LEAVE' && guest.state !== 'CASHOUT') {
      becomeAngry(world, guest);
    }
  }
}

export function tickWorld(world: WorldState, ledger: Ledger, prng: Prng): void {
  world.tick += 1;
  exchangeQueue(world);
  for (const guest of [...world.guests]) {
    if (!world.guests.includes(guest)) continue;
    guestTick(world, ledger, prng, guest);
  }
  maybeStartBrawl(world, prng);
  tickDisputes(world);
  tickAgents(world, ledger, prng);
  decay(world);
  world.reputation = Math.round(reputation(world));
  releaseOrphanSeats(world);
  staffTick(world, ledger);
  // Nach dem Tageswechsel: Veranstaltungen duerfen die Tagesmeldung ueberschreiben.
  tickDemand(world, ledger, prng);
  if (world.player.pathIndex < world.player.path.length) {
    world.player.position = { ...world.player.path[world.player.pathIndex]! };
    world.player.pathIndex += 1;
  }
}
