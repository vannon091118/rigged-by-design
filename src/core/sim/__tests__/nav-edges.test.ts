/**
 * @test-target: src/core/sim/nav-grid.ts
 * @error-code: ERR-2002
 *
 * Waende blockieren Kanten statt Tiles. Tueren und Durchgaenge bleiben
 * passierbar, Objekte haben mehrere Zugaenge, und keine Platzierung darf
 * einen Service abschneiden oder einen Gast durch eine Wand schicken.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { randomSeed } from '../../../test/random-seed';
import { Prng } from '../../rng/prng';
import { canPlaceAt } from '../grid-zones';
import { applyLayout } from '../layout';
import { layoutFromTemplate } from '../layout-derive';
import { edgeKey } from '../layout-edges';
import type { EdgeAxis, EdgeKind, LayoutEdge, LayoutState } from '../layout-types';
import { navGrid, stepOpen, tileIndex } from '../nav-grid';
import { keepsServicesReachable, reachableTiles } from '../nav-reach';
import { accessPoints, approachPoint, findPath } from '../pathfinding';
import { movePlayer } from '../player';
import { spawnGuest } from '../spawn';
import { tickAgents } from '../staff';
import { createWorld } from '../templates';
import type { Point, StaffAgent, WorldState } from '../types';
import { doorPoint, interactionPoint, sendGuest, worldNav } from '../world';

const SIZE = 30;
const START: Point = { x: 16, y: 11 };
const INNER: Point = { x: 11, y: 11 };

const at = (axis: EdgeAxis, x: number, y: number, kind: EdgeKind = 'WALL'): LayoutEdge =>
  ({ axis, x, y, kind, id: kind === 'WALL' ? null : `${kind}-${axis}-${x}-${y}`, zoneId: null });

/** Kanten ueberschreiben: pro Koordinate bleibt genau ein Zustand. */
function addEdges(base: LayoutState, edges: readonly LayoutEdge[]): LayoutState {
  const merged = new Map(base.edges.map((edge) => [edgeKey(edge.axis, edge.x, edge.y), edge]));
  for (const edge of edges) merged.set(edgeKey(edge.axis, edge.x, edge.y), edge);
  return { ...base, edges: [...merged.values()] };
}

const stepsOpen = (nav: ReturnType<typeof navGrid>, path: readonly Point[]): boolean =>
  path.every((point, index) => index === 0 || stepOpen(nav, path[index - 1]!, point));

/** 3x3-Raum mit einer Oeffnung an der Ostseite; `kind` bestimmt den Zustand. */
function room(kind: EdgeKind): LayoutState {
  const edges: LayoutEdge[] = [];
  for (let x = 10; x <= 12; x += 1) edges.push(at('H', x, 10), at('H', x, 13));
  for (let y = 10; y <= 12; y += 1) edges.push(at('V', 10, y), at('V', 13, y));
  const index = edges.findIndex((edge) => edge.axis === 'V' && edge.x === 13 && edge.y === 11);
  edges[index] = at('V', 13, 11, kind);
  return addEdges(layoutFromTemplate('SMALL'), edges);
}

function worldWith(edges: readonly LayoutEdge[]): WorldState {
  const world = createWorld('SMALL');
  applyLayout(world, addEdges(world.layout, edges));
  return world;
}

describe('Wandkanten', () => {
  it('blockiert Uebergaenge in allen vier Richtungen', () => {
    const nav = navGrid(SIZE, [], addEdges(layoutFromTemplate('SMALL'), [
      at('V', 10, 15), at('V', 11, 15), at('H', 10, 15), at('H', 10, 16),
    ]));
    const center = { x: 10, y: 15 };
    expect([
      stepOpen(nav, center, { x: 10, y: 14 }),
      stepOpen(nav, center, { x: 10, y: 16 }),
      stepOpen(nav, center, { x: 9, y: 15 }),
      stepOpen(nav, center, { x: 11, y: 15 }),
    ]).toEqual([false, false, false, false]);
  });

  it('haelt einen geschlossenen Raum dicht', () => {
    const nav = navGrid(SIZE, [], room('WALL'));
    expect(findPath(nav, START, INNER)).toEqual([]);
    expect(reachableTiles(nav, START).has(tileIndex(SIZE, INNER.x, INNER.y))).toBe(false);
  });

  it('laesst Tuer und Durchgang passieren', () => {
    const doorNav = navGrid(SIZE, [], room('DOOR'));
    const doorPath = findPath(doorNav, START, INNER);
    expect(doorPath.at(-1)).toEqual(INNER);
    expect(stepsOpen(doorNav, doorPath)).toBe(true);
    // Der einzige Weg fuehrt durch die Tuer, nicht durch die Wand daneben.
    expect(doorPath.some((point, index) => index > 0
      && point.y === 11 && point.x === 12 && doorPath[index - 1]!.x === 13)).toBe(true);

    const openingNav = navGrid(SIZE, [], room('OPENING'));
    expect(findPath(openingNav, START, INNER).at(-1)).toEqual(INNER);
  });

  it('ersetzt das Raster bei jeder Layout-Aenderung', () => {
    const base = layoutFromTemplate('SMALL');
    const first = navGrid(SIZE, [], base);
    expect(navGrid(SIZE, [], base)).toBe(first);
    const changed = navGrid(SIZE, [], addEdges(base, [at('H', 12, 5)]));
    expect(changed).not.toBe(first);
    expect(changed.walls.has(edgeKey('H', 12, 5))).toBe(true);
    expect(first.walls.has(edgeKey('H', 12, 5))).toBe(false);
  });
});

describe('Zugaenge und Platzierung', () => {
  it('gibt grossen Objekten mehrere Zugaenge und behaelt den Fallback', () => {
    const world = createWorld('SMALL');
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    const points = accessPoints(worldNav(world), bar);
    expect(points.length).toBeGreaterThan(3);
    expect(interactionPoint(world, bar, 1)).not.toEqual(interactionPoint(world, bar, 0));

    const walled = navGrid(world.size, world.furniture,
      addEdges(world.layout, [14, 15, 16, 17].map((x) => at('H', x, 21))));
    const rest = accessPoints(walled, bar);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((point) => point.y !== 21)).toBe(true);
    expect(approachPoint(walled, bar)).not.toBeNull();
  });

  it('schuetzt Serviceobjekte vor dem Versiegeln', () => {
    const world = createWorld('SMALL');
    const nav = worldNav(world);
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    const start = doorPoint(world);
    const access = accessPoints(nav, bar);
    expect(keepsServicesReachable(nav, world.furniture, start, [])).toBe(true);
    expect(keepsServicesReachable(nav, world.furniture, start,
      [tileIndex(world.size, access[0]!.x, access[0]!.y)])).toBe(true);
    expect(keepsServicesReachable(nav, world.furniture, start,
      access.map((point) => tileIndex(world.size, point.x, point.y)))).toBe(false);
  });

  it('verhindert Platzierung auf Tuer-Tiles', () => {
    const layout = addEdges(layoutFromTemplate('SMALL'), [at('V', 6, 3, 'DOOR')]);
    expect(canPlaceAt(SIZE, [], [], 5, 3, 1, 1, true, layout)).toBe(false);
    expect(canPlaceAt(SIZE, [], [], 5, 4, 1, 1, true, layout)).toBe(true);
  });
});

describe('Navigation der Beteiligten', () => {
  it('fuehrt den Spieler nur ueber offene Kanten', () => {
    const world = worldWith([at('H', 10, 17)]);
    world.player.position = { x: 10, y: 15 };
    movePlayer(world, { x: 10, y: 19 });
    expect(world.player.path.at(-1)).toEqual({ x: 10, y: 19 });
    expect(world.player.path.length).toBeGreaterThan(5);
    expect(stepsOpen(worldNav(world), world.player.path)).toBe(true);
  });

  it('schickt Gaeste nicht durch geschlossene Waende', () => {
    const world = worldWith([at('H', 10, 17)]);
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    guest.position = { x: 10, y: 15 };
    expect(sendGuest(world, guest, { x: 10, y: 19 })).toBe(true);
    expect(stepsOpen(worldNav(world), guest.path)).toBe(true);
    expect(guest.path.some((point, index) => index > 0
      && point.x === 10 && point.y === 17 && guest.path[index - 1]!.y === 16)).toBe(false);
  });

  it('bewegt Staff nur ueber offene Kanten', () => {
    const world = worldWith([at('V', 12, 15)]);
    const agent: StaffAgent = {
      id: 99, role: 'cashier', x: 20, y: 25, path: [], pathIndex: 0, carryingCrate: null,
      workTicks: 0, task: 'idle', blockedReason: '', targetDisputeId: null, qualification: 'GESELLE',
    };
    world.agents.push(agent);
    tickAgents(world, new Ledger(), new Prng(randomSeed()));
    expect(agent.path.length).toBeGreaterThan(0);
    expect(stepsOpen(worldNav(world), agent.path)).toBe(true);
  });
});
