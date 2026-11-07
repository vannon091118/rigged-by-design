/**
 * @test-target: src/core/sim/pathfinding.ts
 * @error-code: ERR-2001
 *
 * Der Heap-A* liefert weiterhin kuerzeste, zusammenhaengende Wege; der Nav-Cache
 * bleibt bei Umbauten korrekt. Der Rand ist keine Tile-Sperre mehr – ihn
 * begrenzen die Wandkanten des Layouts (siehe nav-edges.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { navGrid } from '../nav-grid';
import { findPath, isWalkable, nearestWalkable } from '../pathfinding';
import type { Furniture, Point } from '../types';

const SIZE = 30;

function blocker(id: number, x: number, y: number, w = 1, h = 1): Furniture {
  return {
    id, kind: 'SLOT', x, y, w, h, seats: 1, label: 'Block', price: 0 as never, quality: 1,
    condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false, zoneId: 'gaming',
    occupants: [], mods: [], reels: 3, baseBet: 0 as never,
  };
}

const steps = (path: readonly Point[]): number => Math.max(0, path.length - 1);

function contiguous(path: readonly Point[]): boolean {
  return path.every((point, index) => {
    if (index === 0) return true;
    const previous = path[index - 1]!;
    return Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) === 1;
  });
}

describe('A*', () => {
  it('findet den kuerzesten Weg im offenen Feld', () => {
    const nav = navGrid(SIZE, []);
    const path = findPath(nav, { x: 2, y: 2 }, { x: 10, y: 7 });
    expect(path.at(-1)).toEqual({ x: 10, y: 7 });
    expect(steps(path)).toBe(8 + 5);
    expect(contiguous(path)).toBe(true);
  });

  it('geht um Hindernisse herum statt hindurch', () => {
    const wall = Array.from({ length: 20 }, (_, index) => blocker(100 + index, 15, 2 + index));
    const nav = navGrid(SIZE, wall);
    const path = findPath(nav, { x: 10, y: 10 }, { x: 20, y: 10 });
    expect(nav.blocked.has(15 + 10 * SIZE)).toBe(true);
    expect(path.some((point) => point.x === 15 && point.y >= 2 && point.y < 22)).toBe(false);
    expect(contiguous(path)).toBe(true);
    expect(path.at(-1)).toEqual({ x: 20, y: 10 });
  });

  it('meldet ein eingemauertes Ziel als unerreichbar', () => {
    const trap = [blocker(1, 11, 9), blocker(2, 11, 11), blocker(3, 10, 10), blocker(4, 12, 10)];
    const nav = navGrid(SIZE, trap);
    expect(findPath(nav, { x: 2, y: 2 }, { x: 11, y: 10 })).toEqual([]);
  });

  it('gibt das Ziel selbst zurueck, wenn Start und Ziel gleich sind', () => {
    const nav = navGrid(SIZE, []);
    expect(findPath(nav, { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('Navigations-Cache', () => {
  it('liefert dasselbe Raster erneut, solange der Aufbau gleich bleibt', () => {
    const furniture = [blocker(1, 5, 5)];
    const first = navGrid(SIZE, furniture);
    const second = navGrid(SIZE, furniture);
    expect(second).toBe(first);
    expect(first.blocked.has(5 + 5 * SIZE)).toBe(true);
  });

  it('verwirft das Raster, sobald ein Moebel dazukommt oder wandert', () => {
    const furniture = [blocker(1, 5, 5)];
    navGrid(SIZE, furniture);
    furniture.push(blocker(2, 7, 7));
    const grown = navGrid(SIZE, furniture);
    expect(grown.blocked.has(7 + 7 * SIZE)).toBe(true);

    const moved = [blocker(1, 9, 9)];
    const shifted = navGrid(SIZE, moved);
    expect(shifted.blocked.has(9 + 9 * SIZE)).toBe(true);
    expect(shifted.blocked.has(5 + 5 * SIZE)).toBe(false);
  });

  it('faellt bei anderer Brettgroesse nicht auf den alten Cache herein', () => {
    navGrid(SIZE, []);
    const large = navGrid(60, []);
    expect(isWalkable(large, 45, 45)).toBe(true);
    // Randkacheln sind frei; der Rand wird ueber Wandkanten dicht gemacht.
    expect(isWalkable(large, 59, 59)).toBe(true);
    expect(findPath(large, { x: 2, y: 2 }, { x: 59, y: 59 }).at(-1)).toEqual({ x: 59, y: 59 });
  });
});

describe('nearestWalkable', () => {
  it('findet das naechste freie Tile in Ringen von innen nach aussen', () => {
    const nav = navGrid(SIZE, [blocker(1, 5, 5)]);
    const found = nearestWalkable(nav, { x: 5, y: 5 });
    expect(found).not.toBeNull();
    expect(isWalkable(nav, found!.x, found!.y)).toBe(true);
    // Ein Diagonalschritt ist auf dem 4er-Grid zwei Schritte entfernt.
    expect(Math.abs(found!.x - 5) + Math.abs(found!.y - 5)).toBeLessThanOrEqual(2);
  });

  it('gibt das Startfeld zurueck, wenn es frei ist', () => {
    const nav = navGrid(SIZE, []);
    expect(nearestWalkable(nav, { x: 4, y: 4 })).toEqual({ x: 4, y: 4 });
  });
});
