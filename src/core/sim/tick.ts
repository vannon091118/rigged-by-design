/** Ein Tick der Welt: Spawn, Wege, Service, Laune, Dreck, Personal. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { assertGameplayRng } from '../rng/streams';
import { tickDemand } from './demand';
import { TICKS_PER_DAY, tickInDay } from './clock';
import { satisfyNeed } from './needs-core';
import { processNarrativeRuntime } from './narrative/runtime';
import { tickVenueEvents } from './venue-event';
import { tickCity } from './city-tick';
import { maybeStartBrawl, tickDisputes } from './disputes';
import { actAtTarget, chooseActivity, moveGuest, payAndLeave, releaseAndChoose } from './guests';
import { guestAccount, pendingAccount } from './money';
import { reputation } from './spawn';
import { CASHIER_WAIT, tickAgents } from './staff';
import { hasActiveGuard } from './staff-queries';
import { playerStepsPerTick, recoverPlayer } from './player-rpg';
import { tickPlayerNeedsInWorld } from './player-needs-tick';
import { deskServiceTicks, exchangeQueue, arriveAtDesk } from './desk-service';
import { sendGuestToQueue } from './queue-spots';
import { decay, releaseOrphanSeats, staffTick } from './upkeep';
import { advanceActivePlayer } from './active-player';
import { tickForeignFloor } from './foreign-floor-tick';
import { tickRivalMinds } from './rival-ai/tick';
import type { Guest, WorldState } from './types';
import { exchangePoint, furnitureById, sendGuest } from './world';
import { dirtyTileIndex } from './emotion';

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
      world.dirty.add(dirtyTileIndex(world.size, target.x, target.y));
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
      guest.patience = satisfyNeed(guest.patience, 0.35);
      guest.mood = satisfyNeed(guest.mood, 0.05);
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
    // Auszahlung erst am Kopf der Schlange: wer hinter einem anderen steht,
    // wartet sichtbar und wird nicht am Rücken vorbei bedient.
    if (guest.queueIndex > 0) {
      guest.patience = satisfyNeed(guest.patience, 0.5);
      guest.mood = satisfyNeed(guest.mood, 0.05);
      if (guest.patience <= 0) payAndLeave(world, ledger, guest);
      return;
    }
    const cashier = world.agents.find((agent) => agent.role === 'cashier');
    if (cashier && Math.abs(cashier.x - point.x) + Math.abs(cashier.y - point.y) <= 8) {
      guest.stateTicks = Math.max(guest.stateTicks, CASHIER_WAIT);
    }
    if (ledger.getBalance(pendingAccount(guest.id)) > ZERO_VC && guest.stateTicks < CASHIER_WAIT) {
      guest.stateTicks += 1;
      guest.patience = satisfyNeed(guest.patience, 1);
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
  tickCity(world, ledger);
  // Die zentrale Event-Infrastruktur fuehrt Phasen und loest am Fristtick auf,
  // bevor die Narrative-Runtime ihre eigene Fristpruefung sieht.
  tickVenueEvents(world);
  // Der Tag zehrt auch am Spieler: Beduerfnisse laufen im selben Tick wie die Welt.
  tickPlayerNeedsInWorld(world);
  // Verletzung heilt und Lebenspunkte kehren zurueck – im Takt der Welt, nicht der Uhr.
  recoverPlayer(world.player.rpg, world.tick);
  // Die Kampf-Rueckmeldung ist ein kurzer Nachhall, kein Zustand: sie laeuft mit dem Tick ab.
  if (world.fightFx && world.tick > world.fightFx.untilTick) world.fightFx = null;
  // Speed-Stufen laufen mehr als einen Pfadschritt pro Tick – auf dem Boden,
  // auf dem die Figur tatsaechlich steht, nicht immer im eigenen Casino.
  advanceActivePlayer(world, playerStepsPerTick(world.player.rpg));
  // Rivalen handeln vor der Runtime: ihre RIVAL_ACTION-Facts wirken im selben Tick.
  tickRivalMinds(world);
  // Ein Lauf pro Tick: alle Quellen haben Facts emittiert, jetzt Memory/Trigger/Scheduler.
  processNarrativeRuntime(world, ledger);
}

/**
 * Bringt die Uhr bis zum naechsten Tageswechsel und laesst genau den
 * Grenztick durch `tickWorld` laufen. Der Tagesabschluss verarbeitet Loehne,
 * Miete, Strafen und Fremd-Floors einmal; die Stadt fuehrt keinen zweiten
 * Kalender und holt keine 600 Einzeltick-Simulation nach.
 */
export function advanceToNextDay(world: WorldState, ledger: Ledger, prng: Prng): number {
  // Die Uhr ist Weltzustand: der Guard greift, bevor der Tickzaehler wandert.
  assertGameplayRng(prng);
  const ticks = TICKS_PER_DAY - tickInDay(world.tick);
  world.tick += ticks - 1;
  tickWorld(world, ledger, prng);
  return ticks;
}
