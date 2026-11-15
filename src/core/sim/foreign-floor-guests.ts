/**
 * Besucher eines fremden Floors.
 *
 * Der fremde Floor ist ein eigener Raum und traegt deshalb seine eigene
 * Belegung. Erzeugt wird sie aus einem geseedeten Prng, dessen Seed nur aus
 * Rivale und Floor-Kennung entsteht: derselbe Besuch liefert dieselben Gaeste,
 * und ein Save/Load-Roundtrip braucht keine zweite Wahrheit. Es gibt keine
 * Ledger-Bewegung und keinen zweiten Belegungszustand neben dem Floor.
 */
import { Prng } from '../rng/prng';
import { isWalkable } from './pathfinding';
import { makeGuest, randomPersona } from './traits';
import { interactionPoint, worldNav } from './world';
import type { ForeignFloorState, Guest, WorldState } from './types';

/** Eigener Kennungsbereich: fremde Gaeste teilen keine ID mit den eigenen. */
export const FOREIGN_GUEST_ID_BASE = 50_000;

/** FNV-1a: stabiler Seed aus Rivale und Floor, ohne eigene Zufallsquelle. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function foreignFloorSeed(floor: Pick<ForeignFloorState, 'rivalId' | 'id'>): number {
  return fnv1a(`${floor.rivalId}:${floor.id}`);
}

/** Belegung waechst mit dem Haus, bleibt aber innerhalb der Sitzplaetze. */
export function foreignGuestCount(floor: Pick<ForeignFloorState, 'size' | 'furniture'>): number {
  const bySize = floor.size <= 48 ? 3 : floor.size <= 80 ? 4 : 5;
  const seats = floor.furniture.reduce((sum, item) => sum + Math.max(0, item.seats), 0);
  return Math.max(0, Math.min(bySize, seats));
}

/** Sitzmoeglichkeit in fester Reihenfolge: dieselbe Welt, dieselben Plaetze. */
interface SeatSlot { readonly item: ForeignFloorState['furniture'][number]; readonly seat: number; }

function seatSlots(floor: Pick<ForeignFloorState, 'furniture'>): SeatSlot[] {
  const slots: SeatSlot[] = [];
  for (const item of [...floor.furniture].sort((left, right) => left.id - right.id)) {
    for (let seat = 0; seat < item.seats; seat += 1) slots.push({ item, seat });
  }
  return slots;
}

/** Wie viele fremde Gaeste an diesem Moebel sitzen. */
export function foreignSeatOccupancy(floor: Pick<ForeignFloorState, 'guests'>, furnitureId: number): number {
  return (floor.guests ?? []).filter((guest) => guest.targetFurniture === furnitureId).length;
}

/**
 * Legt die Belegung beim ersten Betreten an. Bereits erzeugte Gaeste bleiben
 * unveraendert: ein wiederholter Besuch erzeugt weder leere noch duplizierte
 * Bestaende, und der Save-Roundtrip findet genau diese Figuren wieder.
 */
export function ensureForeignFloorGuests(world: WorldState, floor: ForeignFloorState): Guest[] {
  if (floor.guests && floor.guests.length > 0) return floor.guests;
  const slots = seatSlots(floor);
  const count = foreignGuestCount(floor);
  if (count === 0 || slots.length === 0) {
    floor.guests = floor.guests ?? [];
    return floor.guests;
  }
  const nav = worldNav(world);
  const prng = new Prng(foreignFloorSeed(floor));
  const guests: Guest[] = [];
  for (let index = 0; index < count; index += 1) {
    const slot = slots[index]!;
    const fallback = { x: slot.item.x, y: slot.item.y + slot.item.h };
    const spawn = interactionPoint(world, slot.item, slot.seat)
      ?? (isWalkable(nav, fallback.x, fallback.y) ? fallback : null);
    // Ohne freien Zugang bleibt der Platz leer, statt den Gast in die Wand zu setzen.
    if (!spawn) continue;
    const persona = randomPersona(prng, floor.size >= 90 ? 3 : floor.size >= 60 ? 2 : 1);
    const guest = makeGuest({
      id: FOREIGN_GUEST_ID_BASE + floor.id * 100 + index,
      persona,
      prng,
      spawn,
    });
    guest.targetFurniture = slot.item.id;
    guest.state = slot.item.kind === 'BAR' ? 'DRINK' : slot.item.gameId ? 'PLAY' : 'WAIT';
    guest.lastResult = '';
    guests.push(guest);
  }
  floor.guests = guests;
  return guests;
}
