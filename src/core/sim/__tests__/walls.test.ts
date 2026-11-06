/**
 * @test-target: src/core/sim/walls.ts
 * @error-code: ERR-2002
 *
 * Wand-Ring, Innentuere und Vordertuer sind Sim-Data und stimmen mit dem
 * gemalten Grundriss ueberein; der Weg von der Tuer in den Saal tritt auf
 * keine Wandkachel, und der Cache verarbeitet sich bei Zonenaenderungen neu.
 */
import { describe, expect, it } from 'vitest';
import { approachPoint, blockedTiles, findPath, isWalkable } from '../pathfinding';
import { createWorld } from '../templates';
import { frontDoorSpan, openingsOn, zoneWallTiles } from '../walls';
import type { Zone } from '../types';
import { guestBlocked } from '../world';

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

describe('Wanddaten aus Zonen', () => {
  it('blockt den Zonenring und haelt die Vordertuer offen', () => {
    const world = createWorld('SMALL');
    const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE')!;
    const blocked = blockedTiles(world.size, world.furniture, world.zones);
    expect(isWalkable(world.size, blocked, entrance.x, entrance.y + 1)).toBe(false);
    const front = frontDoorSpan(entrance, 'left')!;
    expect(front).toEqual([entrance.y + Math.floor(entrance.h / 2) - 1, entrance.y + Math.floor(entrance.h / 2) + 1]);
    for (let y = front[0]!; y < front[1]!; y += 1) {
      expect(isWalkable(world.size, blocked, entrance.x, y)).toBe(true);
    }
  });

  it('haelt zugesagte Durchgaenge auf jeder Seite offen', () => {
    const world = createWorld('SMALL');
    for (const zone of world.zones) {
      for (const side of SIDES) {
        for (const [from, to] of openingsOn(zone, world.zones, side, world.size)) {
          for (let value = from; value < to; value += 1) {
            const x = side === 'left' ? zone.x : side === 'right' ? zone.x + zone.w - 1 : value;
            const y = side === 'top' ? zone.y : side === 'bottom' ? zone.y + zone.h - 1 : value;
            const tile = y * world.size + x;
            expect(zoneWallTiles(zone, world.zones, world.size), `${side} ${x},${y}`).not.toContain(tile);
          }
        }
      }
    }
  });

  it('traegt den Weg von Tuer zu Kasse auf keine Wandkachel', () => {
    const world = createWorld('SMALL');
    const blocked = guestBlocked(world);
    const desk = world.furniture.find((item) => item.kind === 'EXCHANGE')!;
    const goal = approachPoint(world.size, blocked, desk)!;
    const path = findPath(world.size, blocked, { x: 0, y: 15 }, goal);
    expect(path.length, 'Eingang und Kasse bleiben verbunden').toBeGreaterThan(1);
    const walls = new Set<number>();
    for (const zone of world.zones) {
      for (const tile of zoneWallTiles(zone, world.zones, world.size)) walls.add(tile);
    }
    for (const step of path.slice(1)) {
      expect(walls.has(step.y * world.size + step.x)).toBe(false);
    }
  });

  it('erzeugt bei geaenderter Zone einen neuen Blockiersatz', () => {
    const world = createWorld('SMALL');
    const base = blockedTiles(world.size, world.furniture, world.zones);
    const moved = world.zones.map((zone): Zone =>
      zone.id === 'lounge' ? { ...zone, x: zone.x + 1 } : zone);
    const next = blockedTiles(world.size, world.furniture, moved);
    expect(next).not.toBe(base);
    expect(isWalkable(world.size, base, 6, 21)).toBe(false);
    expect(isWalkable(world.size, next, 6, 21)).toBe(true);
  });
});
