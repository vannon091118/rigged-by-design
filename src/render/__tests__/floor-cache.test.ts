/**
 * @test-target: src/render/floor-math.ts
 * @error-code: ERR-3001
 *
 * Regions-Hash, Invalidierung, LOD, Culling und Koordinaten sind reine Mathe.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import {
  changedRegions,
  isVisible,
  lodFor,
  regionHash,
  screenToTile,
  visibleRect,
} from '../floor-math';

function worldWith(slotX: number, slotY: number) {
  const world = createWorld('SMALL');
  return {
    view: {
      size: world.size,
      template: world.template,
      carpet: world.carpet,
      zones: world.zones,
      furniture: [{ id: 7, x: slotX, y: slotY, w: 1, h: 1 }],
      dirtyTiles: new Set<number>(),
    },
  };
}

describe('Regions-Hash', () => {
  it('bleibt stabil, wenn sich nur Möbel bewegen, und kippt bei Zonenwechsel', () => {
    const a = worldWith(5, 5);
    const b = worldWith(6, 5);
    const areas = [{ id: 'area-0', index: 0, x: 0, y: 0, w: 30, h: 30 }];
    expect(regionHash(a.view as never, areas[0]!)).toBe(regionHash(b.view as never, areas[0]!));
    const otherCarpet = { ...a.view, carpet: 'GOLD' as const };
    expect(regionHash(otherCarpet as never, areas[0]!)).not.toBe(regionHash(a.view as never, areas[0]!));
  });

  it('meldet nur veränderte Regionen', () => {
    const zone = { id: 'gaming', kind: 'GAMING', x: 35, y: 5, w: 10, h: 10, color: 1 };
    const base = { size: 60, template: 'MEDIUM', carpet: 'VIOLET', zones: [zone], furniture: [], dirtyTiles: new Set<number>() };
    const areas = [
      { id: 'area-0', index: 0, x: 0, y: 0, w: 30, h: 30 },
      { id: 'area-1', index: 1, x: 30, y: 0, w: 30, h: 30 },
    ];
    const prev = new Map(areas.map((area) => [area.id, regionHash(base as never, area)]));
    const grown = { ...base, zones: [{ ...zone, w: 12 }] };
    expect(changedRegions(grown as never, areas, prev)).toEqual(['area-1']);
  });
});

describe('LOD und Kamera', () => {
  it('schaltet Detail erst oberhalb der Schwelle um', () => {
    expect(lodFor(1.0, 1.0)).toBe(false);
    expect(lodFor(1.12, 1.0)).toBe(false);
    expect(lodFor(1.13, 1.0)).toBe(true);
  });
});

describe('Culling', () => {
  it('behält teilweise sichtbare Objekte und schneidet Rest weg', () => {
    const rect = visibleRect(0, 0, 1, 800, 600);
    expect(isVisible(700, 500, 200, 200, rect, 0)).toBe(true);
    expect(isVisible(900, 700, 50, 50, rect, 0)).toBe(false);
    expect(isVisible(840, 100, 50, 50, visibleRect(0, 0, 1, 800, 600), 60)).toBe(true);
  });
});

describe('Koordinaten', () => {
  it('rechnet Bildschirmpixel in Tiles um und clampet Ränder', () => {
    const tile = TILE;
    expect(screenToTile(30, 60, { left: 0, top: 0, width: 800 }, 800, 0, 0, 1, 90)).toEqual({
      x: Math.floor(30 / tile), y: Math.floor(60 / tile),
    });
    expect(screenToTile(-5, -5, { left: 0, top: 0, width: 800 }, 800, 0, 0, 1, 30)).toBeNull();
    expect(screenToTile(799, 599, { left: 0, top: 0, width: 800 }, 800, 0, 0, 1, 30)).toBeNull();
  });
});
