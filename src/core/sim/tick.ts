/** Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { assertGameplayRng } from '../rng/streams';
import { tickDemand } from './demand';
import { maybeStartBrawl, tickDisputes } from './disputes';
import { actAtTarget, chooseActivity, moveGuest, payAndLeave, releaseAndChoose } from './guests';
import { guestAccount, pendingAccount } from './money';
import { reputation } from './spawn';
import { CASHIER_WAIT, tickAgents } from './staff';
import { hasActiveGuard } from './staff-queries';
import { playerStepsPerTick, recoverPlayer } from './player-rpg';
import { deskServiceTicks, exchangeQueue, arriveAtDesk } from './desk-service';
import { sendGuestToQueue } from './queue-spots';
import { decay, releaseOrphanSeats, staffTick } from './upkeep';
import { tickForeignFloor } from './foreign-floor-tick';
import type { Guest, WorldState } from './types';
import { exchangePoint, furnitureById, sendGuest } from './world';

function angerTick(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): void {
  guest.stateTicks += 1;
  if (guest.stateTicks === 1) {
    // Randaliert wird am Angebot, nicht an Kasse, Lager oder Personalinfrastruktur.
    const candidates = world.furniture.filter((item) => item.gameId || item.kind === 'DECOR');
    const target = candidates[prng.nextInt(0, Math.max(0, candidates.length - 1))];
    const guard = hasActiveGuard(world);
    if (target && prng.nextFloat() < (guard ? 0.25 : 0.6)) {
      const damage = 4 + prng.nextInt(0, 10);
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

function guestTick(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): void {
  if (guest.state === 'ENTER') {
    const point = exchangePoint(world);
    if (!point) return;
    sendGuestToQueue(world, guest);
    if (moveGuest(guest)) { guest.state = 'EXCHANGE'; guest.stateTicks = 0; }
    return;
  }
  if (guest.state === 'EXCHANGE') {
    if (guest.queueIndex > 0) {
      guest.stateTicks = 0;
      guest.patience = Math.max(0, guest.patience - 0.35);
      guest.mood = Math.max(0, guest.mood - 0.05);
      if (guest.patience <= 0) { payAndLeave(world, ledger, guest); return; }
    }
    guest.stateTicks += 1;
    if (guest.stateTicks < deskServiceTicks(world)) return;
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
    sendGuestToQueue(world, guest);
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

export function tickWorld(world: WorldState, ledger: Ledger, prng: Prng): void {
  assertGameplayRng(prng);
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
  staffTick(world, ledger, prng);
  // Fremde Floors ticken mit (Job-Task-Fortschritt etc.)
  for (const floor of world.foreignFloors) {
    tickForeignFloor(world, floor, prng);
  }
  // Nach dem Tageswechsel: Veranstaltungen duerfen die Tagesmeldung ueberschreiben.
  tickDemand(world, ledger, prng);
  // Verletzung heilt und Lebenspunkte kehren zurueck – im Takt der Welt, nicht der Uhr.
  recoverPlayer(world.player.rpg, world.tick);
  // Die Kampf-Rueckmeldung ist ein kurzer Nachhall, kein Zustand: sie laeuft mit dem Tick ab.
  if (world.fightFx && world.tick > world.fightFx.untilTick) world.fightFx = null;
  // Speed-Stufen laufen mehr als einen Pfadschritt pro Tick.
  const steps = playerStepsPerTick(world.player.rpg);
  for (let step = 0; step < steps && world.player.pathIndex < world.player.path.length; step += 1) {
    world.player.position = { ...world.player.path[world.player.pathIndex]! };
    world.player.pathIndex += 1;
  }
}
