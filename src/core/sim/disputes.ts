/** Streit: Wut wird zum sichtbaren Disput mit Position, Beteiligten und Eskalation. */
import type { Prng } from '../rng/prng';
import type { WorldState } from './types';
import { furnitureById, guestById } from './world';

const BRAWL_RANGE = 5;
const GUARD_RANGE = 7;

const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

function resolveDispute(world: WorldState, id: number, calmed: boolean): void {
  const dispute = world.disputes.find((entry) => entry.id === id);
  if (!dispute) return;
  world.disputes = world.disputes.filter((entry) => entry.id !== id);
  for (const guestId of dispute.guestIds) {
    const guest = guestById(world, guestId);
    if (!guest) continue;
    guest.disputeId = null;
    if (guest.state === 'ANGRY') {
      guest.state = 'CHOOSE';
      guest.stateTicks = 0;
      if (calmed) {
        guest.mood = Math.min(100, guest.mood + 5);
        guest.patience = Math.min(100, guest.patience + 5);
      }
    }
  }
  world.lastEvent = calmed ? 'Der Streit wurde geschlichtet.' : 'Der Streit ist verraucht.';
}

/** Zwei wütende Gäste in Reichweite prügeln sich statt einzeln zu toben. */
export function maybeStartBrawl(world: WorldState, prng: Prng, forced = false): void {
  for (const guest of world.guests) {
    if (guest.state !== 'ANGRY' || guest.disputeId !== null) continue;
    const other = world.guests.find((entry) =>
      entry.id !== guest.id && entry.state === 'ANGRY' && entry.disputeId === null
      && dist(guest.position.x, guest.position.y, entry.position.x, entry.position.y) <= BRAWL_RANGE);
    if (!other) continue;
    if (!forced && prng.nextFloat() > 0.5) continue;
    const id = world.nextDisputeId++;
    world.disputes.push({
      id,
      guestIds: [guest.id, other.id],
      x: Math.round((guest.position.x + other.position.x) / 2),
      y: Math.round((guest.position.y + other.position.y) / 2),
      level: 1,
      ticks: 0,
    });
    guest.disputeId = id;
    other.disputeId = id;
    world.lastEvent = `${guest.name} und ${other.name} prügeln sich.`;
  }
}

interface DisputeLike { readonly x: number; readonly y: number }

/**
 * Greift hier wirklich ein Guard ein? Die Simulation beendet einen Streit nur
 * dann, und die UI darf die Spieleroption nur dann ausblenden.
 */
export function guardResponding(world: WorldState, dispute: DisputeLike): boolean {
  return world.agents.some((agent) =>
    agent.role === 'guard' && dist(agent.x, agent.y, dispute.x, dispute.y) <= GUARD_RANGE);
}

/** Eskalation beschädigt Geräte; ein Guard in der Nähe beendet den Disput sofort. */
/** Die UI darf die Spieleroption nur ausblenden, wenn der Guard wirklich eingreift. */
export function tickDisputes(world: WorldState): void {
  for (const dispute of [...world.disputes]) {
    dispute.ticks += 1;
    dispute.level = dispute.ticks > 6 ? 2 : 1;
    if (guardResponding(world, dispute)) { resolveDispute(world, dispute.id, true); continue; }
    dispute.guestIds = dispute.guestIds.filter((id) => {
      const guest = guestById(world, id);
      return guest !== null && guest.state === 'ANGRY';
    });
    for (const id of dispute.guestIds) {
      const guest = guestById(world, id);
      if (guest) guest.mood = Math.max(0, guest.mood - 1);
    }
    if (dispute.guestIds.length < 2) { resolveDispute(world, dispute.id, false); continue; }
    if (dispute.level === 2 && dispute.ticks % 3 === 0) {
      const targets = world.furniture.filter((item) => item.kind !== 'EXCHANGE' && !item.damaged);
      if (targets.length === 0) continue;
      let nearest = targets[0]!;
      for (const item of targets) {
        if (dist(item.x, item.y, dispute.x, dispute.y) < dist(nearest.x, nearest.y, dispute.x, dispute.y)) nearest = item;
      }
      const live = furnitureById(world, nearest.id);
      if (live) {
        live.condition = Math.max(0, live.condition - 10);
        live.damaged = true;
        world.dirty.add((live.y + 1) * world.size + live.x + 1);
        world.lastEvent = `Im Streit ging ${live.label} zu Bruch.`;
      }
    }
  }
}

/** Der Spieler schlichtet nur, was er körperlich erreicht. */
export function calmDispute(world: WorldState, id: number): boolean {
  const dispute = world.disputes.find((entry) => entry.id === id);
  if (!dispute) return false;
  if (dist(world.player.position.x, world.player.position.y, dispute.x, dispute.y) > 4) return false;
  resolveDispute(world, id, true);
  return true;
}
