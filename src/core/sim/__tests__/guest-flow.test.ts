/** @test-target: src/core/sim/world.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { exchangeQueue } from '../desk-service';
import { leave } from '../guests';
import { guestAccount } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import type { WorldState } from '../types';
import { deskQueueSpot, doorPoint, entranceSpot, freeSeat, reserveSeat } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup(template: WorldState['template'] = 'SMALL') {
  const world = createWorld(template);
  const ledger = new Ledger();
  return { world, ledger, prng: new Prng(randomSeed()) };
}

describe('Besucherfluss und Reservierungen', () => {
  const step = (world: WorldState, ledger: Ledger, prng: Prng): void => tickWorld(world, ledger, prng);

  it('führt vom Aussenplatz über den Eingang zur Kasse und wieder hinaus, ohne Teleport', () => {
    const { world, ledger, prng } = setup('MEDIUM');
    const door = doorPoint(world);
    const guest = spawnGuest(world, prng, ledger)!;
    expect(guest.position).toEqual(door);
    expect(guest.state).toBe('ENTER');

    const trail = [{ ...guest.position }];
    const record = (): void => { if (world.guests.includes(guest)) trail.push({ ...guest.position }); };
    let guard = 0;
    while (guest.state === 'ENTER' && guard < 400) { step(world, ledger, prng); record(); guard += 1; }
    expect(guest.state).toBe('EXCHANGE');

    guard = 0;
    while (ledger.getBalance(guestAccount(guest.id)) === 0 && guard < 40) { step(world, ledger, prng); record(); guard += 1; }
    expect(ledger.getBalance(guestAccount(guest.id))).toBeGreaterThan(0);

    leave(world, guest);
    guard = 0;
    while (world.guests.includes(guest) && guard < 600) { step(world, ledger, prng); record(); guard += 1; }
    expect(world.guests).not.toContain(guest);

    // Kein Sprung zwischen zwei Ticks: jeder Schritt bleibt auf Nachbarkacheln.
    for (let index = 1; index < trail.length; index += 1) {
      const before = trail[index - 1]!;
      const after = trail[index]!;
      expect(Math.abs(before.x - after.x) + Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
    }
    // Drinnen war er wirklich, verlassen hat er das Haus an der Tuer.
    expect(trail.some((point) => point.x > door.x)).toBe(true);
    expect(guest.position).toEqual(door);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verteilt gleichzeitig eintreffende Gaeste auf eigene Aussenplaetze', () => {
    const { world, ledger, prng } = setup('MEDIUM');
    expect(entranceSpot(world)).toEqual(doorPoint(world));
    const guests = Array.from({ length: 4 }, () => spawnGuest(world, prng, ledger)!);
    const tiles = new Set(guests.map((guest) => `${guest.position.x},${guest.position.y}`));
    expect(tiles.size).toBe(guests.length);
    const door = doorPoint(world);
    for (const guest of guests) expect(guest.position.x).toBeLessThanOrEqual(door.x);
  });

  it('gibt jedem Gast in der Kassenschlange eine eigene Position', () => {
    const { world, ledger, prng } = setup('MEDIUM');
    const guests = Array.from({ length: 5 }, () => spawnGuest(world, prng, ledger)!);
    for (const guest of guests) guest.state = 'EXCHANGE';
    exchangeQueue(world);
    expect(guests.map((guest) => guest.queueIndex).sort()).toEqual([0, 1, 2, 3, 4]);
    const spots = new Set(guests.map((guest) => {
      const spot = deskQueueSpot(world, guest);
      return `${spot.x},${spot.y}`;
    }));
    expect(spots.size).toBe(guests.length);
  });

  it('reserviert einen Geräteplatz genau einmal', () => {
    const { world } = setup();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    expect(reserveSeat(world, slot.id, 1)).toBe(true);
    expect(reserveSeat(world, slot.id, 1)).toBe(false);
    expect(slot.occupants).toEqual([1]);
    expect(freeSeat(slot)).toBe(false);
  });

  it('laesst weit mehr als 28 Gaeste gleichzeitig im Haus und in der Schlange', () => {
    const { world, ledger, prng } = setup('LARGE');
    const guests = Array.from({ length: 40 }, () => spawnGuest(world, prng, ledger));
    expect(guests.every((guest) => guest !== null)).toBe(true);
    expect(world.guests).toHaveLength(40);
    guests.forEach((guest, index) => { if (guest && index % 2 === 0) guest.state = 'EXCHANGE'; });
    exchangeQueue(world);
    expect(world.guests.filter((guest) => guest.queueIndex > 0).length).toBeGreaterThan(18);
    expect(new Set(world.guests.map((guest) => guest.queueIndex)).size).toBe(40);
  });

  it('stoppt den Zulauf nicht bei einer festen Gaestezahl', () => {
    const { world, ledger, prng } = setup('LARGE');
    for (let index = 0; index < 40; index += 1) spawnGuest(world, prng, ledger);
    const before = world.nextGuestId;
    const extra = spawnGuest(world, prng, ledger);
    expect(extra).not.toBeNull();
    expect(world.guests.length).toBe(41);
    expect(world.nextGuestId).toBeGreaterThan(before);
    for (let index = 0; index < 40; index += 1) spawnGuest(world, prng, ledger);
    expect(world.guests.length).toBeGreaterThan(80);
  });
});
