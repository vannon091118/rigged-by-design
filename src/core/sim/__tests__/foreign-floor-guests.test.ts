/**
 * @test-target: src/core/sim/foreign-floor-guests.ts | @error-code: ERR-3001
 *
 * Fremde Floors tragen ihre eigene Belegung: geseedet aus Rivale und Floor,
 * innerhalb der Sitzplaetze, stabil ueber Besuche und ohne eigenen Weltzustand.
 */
import { describe, expect, it } from 'vitest';
import { activeForeignFloor } from '../active-player';
import {
  FOREIGN_GUEST_ID_BASE, foreignGuestCount, foreignSeatOccupancy,
} from '../foreign-floor-guests';
import { createWorld } from '../templates';
import type { RivalId } from '../types';
import { visitForeignCmd, leaveForeignCmd } from '../../../store/foreign-floor-commands';

function visit(rival: RivalId = 'HAFENKLAUSE') {
  const world = createWorld('SMALL');
  visitForeignCmd(world, rival);
  const floor = activeForeignFloor(world);
  if (!floor) throw new Error('Foreign Floor fehlt.');
  return { world, floor };
}

const fingerprint = (guests: readonly { id: number; name: string; position: { x: number; y: number }; targetFurniture: number }[]) =>
  guests.map((guest) => `${guest.id}|${guest.name}|${guest.position.x},${guest.position.y}|${guest.targetFurniture}`);

describe('Belegung fremder Floors', () => {
  it('erzeugt beim Betreten Gaeste innerhalb der vorhandenen Sitzplaetze', () => {
    const { floor } = visit();
    const guests = floor.guests ?? [];
    const seats = floor.furniture.filter((item) => item.seats > 0);

    expect(guests.length).toBeGreaterThan(0);
    expect(guests.length).toBe(foreignGuestCount(floor));
    expect(guests.length).toBeLessThanOrEqual(seats.reduce((sum, item) => sum + item.seats, 0));
    for (const guest of guests) {
      expect(guest.id).toBeGreaterThanOrEqual(FOREIGN_GUEST_ID_BASE);
      const seat = seats.find((item) => item.id === guest.targetFurniture);
      expect(seat?.id).toBe(guest.targetFurniture);
      expect(seat?.seats).toBeGreaterThan(0);
      expect(foreignSeatOccupancy(floor, guest.targetFurniture)).toBeLessThanOrEqual(seat!.seats);
    }
  });

  it('liefert fuer dieselbe Welt und denselben Rivalen dieselbe Belegung', () => {
    const first = visit('GOLDENE_HAND').floor;
    const second = visit('GOLDENE_HAND').floor;

    expect(fingerprint(second.guests ?? [])).toEqual(fingerprint(first.guests ?? []));
  });

  it('unterscheidet die Belegung verschiedener Rivalen', () => {
    const harbor = visit('HAFENKLAUSE').floor;
    const fog = visit('NEBELPALAST').floor;

    expect(fingerprint(fog.guests ?? [])).not.toEqual(fingerprint(harbor.guests ?? []));
  });

  it('erzeugt beim erneuten Besuch weder leere noch doppelte Belegung', () => {
    const { world, floor } = visit();
    const before = fingerprint(floor.guests ?? []);
    const ids = (floor.guests ?? []).map((guest) => guest.id);

    leaveForeignCmd(world);
    visitForeignCmd(world, 'HAFENKLAUSE');
    const after = activeForeignFloor(world)!;

    expect(new Set(ids).size).toBe(ids.length);
    expect(fingerprint(after.guests ?? [])).toEqual(before);
  });
});
