/**
 * @test-target: src/core/sim/business-areas.ts
 * @error-code: ERR-2001
 *
 * Die Bereiche sind der eine WorldState: Zonen tragen sie, Objekte stehen
 * darin, Gaeste steuern sie an. Geprueft wird der echte Bestand, der Zonenrand,
 * die Zaehlung ueber das Ziel, ein echter Ticklauf mit Seed und ein Haus ohne
 * den Bereich.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { businessAreas, type BusinessArea, type BusinessAreaId } from '../business-areas';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import type { Zone } from '../types';

const area = (areas: readonly BusinessArea[], id: BusinessAreaId): BusinessArea =>
  areas.find((entry) => entry.id === id)!;

const inZones = (zones: readonly Zone[], x: number, y: number): boolean =>
  zones.some((zone) => x >= zone.x && y >= zone.y && x < zone.x + zone.w && y < zone.y + zone.h);

describe('Business-Bereiche aus dem einen WorldState', () => {
  it('fuehrt genau Casino, Bar und Lounge und liefert bei gleichem Zustand dasselbe', () => {
    const world = createWorld('SMALL');
    const areas = businessAreas(world);
    expect(areas.map((entry) => entry.id)).toEqual(['CASINO', 'BAR', 'LOUNGE']);
    expect(areas.map((entry) => entry.name)).toEqual(['Casino', 'Bar', 'Lounge']);
    expect(businessAreas(world)).toEqual(areas);
  });

  it('zaehlt Zonen, Objekte und Sitzplaetze aus dem echten Bestand', () => {
    const world = createWorld('SMALL');
    const gaming = world.zones.filter((zone) => zone.kind === 'GAMING');
    const barZones = world.zones.filter((zone) => zone.kind === 'BAR');
    const casino = area(businessAreas(world), 'CASINO');
    const bar = area(businessAreas(world), 'BAR');

    expect(casino.open).toBe(true);
    expect(casino.zones).toBe(gaming.length);
    expect(casino.objects).toBe(world.furniture.filter((item) => inZones(gaming, item.x, item.y)).length);
    expect(casino.objects).toBeGreaterThan(0);
    expect(bar.open).toBe(true);
    expect(bar.zones).toBe(barZones.length);
    expect(bar.objects).toBe(world.furniture.filter((item) => inZones(barZones, item.x, item.y)).length);
    expect(casino.seats + bar.seats).toBeGreaterThan(0);
    expect(casino.guests + bar.guests).toBe(0);
  });

  it('der Zonenrand entscheidet: ein Feld hinter dem Rand zaehlt nicht mehr', () => {
    const world = createWorld('SMALL');
    const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE')!;
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    guest.targetFurniture = 0;
    guest.position = { x: lounge.x + lounge.w, y: lounge.y };
    expect(area(businessAreas(world), 'LOUNGE').guests).toBe(0);
    guest.position = { x: lounge.x + lounge.w - 1, y: lounge.y + lounge.h - 1 };
    expect(area(businessAreas(world), 'LOUNGE').guests).toBe(1);
  });

  it('ein Gast zaehlt in dem Bereich, den er ansteuert, und nie in zwei', () => {
    const world = createWorld('SMALL');
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;

    guest.position = { x: 1, y: 1 };
    guest.targetFurniture = slot.id;
    expect(area(businessAreas(world), 'CASINO').guests).toBe(1);
    expect(area(businessAreas(world), 'BAR').guests).toBe(0);

    guest.targetFurniture = bar.id;
    expect(area(businessAreas(world), 'BAR').guests).toBe(1);
    expect(area(businessAreas(world), 'CASINO').guests).toBe(0);
  });

  it('nach einem echten Ticklauf sind Gaeste zugeordnet und die Summe bleibt begrenzt', () => {
    const run = (seed: number) => {
      const world = createWorld('SMALL');
      const ledger = new Ledger({ HAUSKONTO: fromVC(500) });
      const prng = new Prng(seed);
      for (let index = 0; index < 400; index += 1) tickWorld(world, ledger, prng);
      return { areas: businessAreas(world), guests: world.guests.length };
    };
    const seed = randomSeed();
    const first = run(seed);
    const second = run(seed);
    expect(second.areas).toEqual(first.areas);

    const counted = first.areas.reduce((sum, entry) => sum + entry.guests, 0);
    expect(counted).toBeGreaterThan(0);
    expect(counted).toBeLessThanOrEqual(first.guests);
  });

  it('ein Haus ohne den Bereich meldet ihn geschlossen und zaehlt nichts', () => {
    const world = createWorld('SMALL');
    world.zones = world.zones.filter((zone) => zone.kind !== 'LOUNGE');
    expect(area(businessAreas(world), 'LOUNGE')).toEqual({
      id: 'LOUNGE', name: 'Lounge', open: false, zones: 0, objects: 0, seats: 0, guests: 0,
    });
  });
});
