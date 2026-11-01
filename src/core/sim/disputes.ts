/** Streit: Wut wird zum sichtbaren Disput mit Position, Beteiligten und Eskalation. */
import type { Prng } from '../rng/prng';
import { staffAgents } from './staff-queries';
import { grantGlobalXp } from './player-rpg';
import type { Dispute, Point, WorldState } from './types';
import { furnitureById, guestById } from './world';

const BRAWL_RANGE = 5;
/**
 * Ein Security bearbeitet einen Streit erst, wenn er tatsaechlich davorsteht.
 * Weder die Einstellung noch die Distanz allein entscheiden, sondern die Frage,
 * ob gerade jemand vor Ort ist – und nur das darf die Spieleroption sperren.
 */
export const GUARD_HANDLE_RANGE = 2;

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
  if (calmed) grantGlobalXp(world.player.rpg, 'CALM_DISPUTE', 25);
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
 * Arbeitet gerade ein Security an diesem Streit? Massgeblich ist, dass der
 * Agent diesen Streit als Auftrag traegt und am Tatort steht – nicht, ob
 * generell jemand eingestellt ist. Solange das nicht zutrifft, darf der
 * Spieler selbst eingreifen.
 */
export function guardHandling(world: WorldState, dispute: DisputeLike & { readonly id?: number }): boolean {
  return staffAgents(world, 'guard').some((agent) => {
    if (dist(agent.x, agent.y, dispute.x, dispute.y) > GUARD_HANDLE_RANGE) return false;
    // Ein anderweitig beauftragter Zaehlt nicht: der bearbeitet woanders etwas.
    return agent.targetDisputeId === null
      || (dispute.id !== undefined && agent.targetDisputeId === dispute.id);
  });
}

/** Der naechste Streit aus Sicht einer Position; ohne Streit gibt es keinen Posten. */
export function nearestDispute(world: WorldState, from: Point): Dispute | null {
  let best: Dispute | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const dispute of world.disputes) {
    const distance = dist(from.x, from.y, dispute.x, dispute.y);
    if (distance < bestDistance) { best = dispute; bestDistance = distance; }
  }
  return best;
}

/**
 * Eskalation beschaedigt Gerate; ein Security, der am Tatort steht, beendet
 * den Disput sofort. Ein naher, aber anderweitig beauftragter Streit zaehlt
 * nicht – deshalb pruefen wir die Zuteilung und nicht nur die Distanz.
 */
export function tickDisputes(world: WorldState): void {
  for (const dispute of [...world.disputes]) {
    dispute.ticks += 1;
    dispute.level = dispute.ticks > 6 ? 2 : 1;
    if (guardHandling(world, dispute)) { resolveDispute(world, dispute.id, true); continue; }
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

/**
 * Der Spieler schlichtet nur, was er koeperlich erreicht, und nie einen
 * Streit, den ein Security gerade in Bearbeitung hat – sonst arbeiten beide
 * gleichzeitig an derselben Sache.
 */
export function calmDispute(world: WorldState, id: number): boolean {
  const dispute = world.disputes.find((entry) => entry.id === id);
  if (!dispute) return false;
  if (guardHandling(world, dispute)) throw new Error('Der Security ist bereits vor Ort und bearbeitet den Streit.');
  if (dist(world.player.position.x, world.player.position.y, dispute.x, dispute.y) > 4) return false;
  resolveDispute(world, id, true);
  return true;
}
