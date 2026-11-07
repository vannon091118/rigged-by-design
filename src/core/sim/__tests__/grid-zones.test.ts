/**
 * @test-target: src/core/sim/grid-zones.ts
 * @error-code: ERR-2002
 */
import { describe, expect, it } from 'vitest';
import type { VaCoinMicro } from '../../economy/vacoin';
import { accessPoint, areaAt, areasFor, canPlaceAt, GAME_FOOTPRINT, REGION, SERVICE_FOOTPRINT } from '../grid-zones';
import { getBuildDef } from '../offers';
import { createWorld } from '../templates';
import { seatPoint } from '../world';
import type { Furniture, TemplateId } from '../types';

const TEMPLATES: readonly TemplateId[] = ['SMALL', 'MEDIUM', 'LARGE'];

const block = (id: number, x: number, y: number): Furniture => ({
  id, kind: 'DECOR', x, y, w: 1, h: 1, seats: 0, label: 'block', price: 0 as VaCoinMicro,
  quality: 1, condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false,
  zoneId: 'lounge', occupants: [], mods: [], reels: 0, baseBet: 0 as VaCoinMicro,
});

describe('30x30-Bereiche und Multi-Tile', () => {
  it('teilt jede Vorlage in vollstaendige 30x30-Bereiche', () => {
    for (const template of TEMPLATES) {
      const world = createWorld(template);
      const areas = areasFor(template);
      expect(areas).toHaveLength((world.size / REGION) ** 2);
      for (const area of areas) {
        expect(area.w).toBe(REGION);
        expect(area.h).toBe(REGION);
        expect(areaAt(template, area.x, area.y)).toBe(area);
      }
      expect(areaAt(template, world.size - 1, world.size - 1)).not.toBeNull();
      expect(areaAt(template, world.size, 0)).toBeNull();
    }
  });

  it('gibt jedem Spiel und Servicepunkt einen festen Footprint', () => {
    expect(GAME_FOOTPRINT.SLOT).toEqual({ w: 1, h: 1, seats: 1 });
    expect(GAME_FOOTPRINT.ROULETTE).toEqual({ w: 3, h: 2, seats: 6 });
    expect(GAME_FOOTPRINT.BLACKJACK).toEqual({ w: 2, h: 2, seats: 4 });
    expect(GAME_FOOTPRINT.POKER).toEqual({ w: 2, h: 2, seats: 4 });
    expect(SERVICE_FOOTPRINT.BAR).toEqual({ w: 4, h: 2, seats: 4 });
    expect(SERVICE_FOOTPRINT.TOILET).toEqual({ w: 2, h: 2, seats: 2 });
    expect(SERVICE_FOOTPRINT.EXCHANGE).toEqual({ w: 2, h: 2, seats: 1 });
    expect(SERVICE_FOOTPRINT.STORAGE).toEqual({ w: 3, h: 3, seats: 0 });
    expect(getBuildDef('SOFA')).toMatchObject({ w: 2, h: 1, seats: 2 });
    for (const game of ['SLOT', 'PLINKO', 'BLACKJACK', 'POKER', 'ROULETTE', 'SHELL', 'DICE'] as const) {
      expect(getBuildDef(game)).toMatchObject(GAME_FOOTPRINT[game]);
    }
  });

  it('gibt jedem Sitzplatz in jeder Vorlage ein freies Zugangs-Tile', () => {
    for (const template of TEMPLATES) {
      const world = createWorld(template);
      for (const item of world.furniture) {
        expect(item.w, `${template}-${item.label}-w`).toBeGreaterThan(0);
        expect(item.h, `${template}-${item.label}-h`).toBeGreaterThan(0);
        if (item.seats > 0) {
          expect(accessPoint(world.size, world.furniture, item.x, item.y, item.w, item.h), item.label).not.toBeNull();
        }
      }
    }
  });

  it('verteilt die Sitzplaetze eines Tisches auf eigene Tiles', () => {
    const world = createWorld('MEDIUM');
    const roulette = world.furniture.find((item) => item.gameId === 'ROULETTE')!;
    const points = Array.from({ length: roulette.seats }, (_, seat) => seatPoint(world, roulette, seat)!);
    const keys = new Set(points.map((point) => `${point.x},${point.y}`));
    expect(points).toHaveLength(6);
    expect(keys.size).toBeGreaterThanOrEqual(4);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('prueft die komplette Flaeche und verlangt ein Zugangs-Tile', () => {
    const world = createWorld('SMALL');
    const ring = [block(900, 4, 5), block(901, 6, 5), block(902, 5, 4), block(903, 5, 6)];
    expect(canPlaceAt(world.size, ring, [], 5, 5, 1, 1, true)).toBe(false);
    expect(canPlaceAt(world.size, ring, [], 5, 5, 1, 1, false)).toBe(true);
    expect(canPlaceAt(world.size, world.furniture, [], 20, 12, 1, 1, true)).toBe(true);
    expect(canPlaceAt(world.size, world.furniture, [{ x: 20, y: 12 }], 20, 12, 1, 1, true)).toBe(false);
    expect(canPlaceAt(world.size, world.furniture, [], 16, 6, 1, 1, true)).toBe(false);
  });
});
