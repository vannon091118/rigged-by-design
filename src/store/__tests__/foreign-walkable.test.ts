/**
 * @test-target: src/store/foreign-floor-commands.ts | @error-code: ERR-3001
 *
 * Der fremde Floor ist begehbar: Bewegung, Tick, Maus-/Touch-Laufauftrag,
 * Snapshot und Save lesen denselben foreign-eigenen Spielerstand. Der eigene
 * Stand im Casino darf dabei unangetastet bleiben.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { enqueueTask, tickActionQueue } from '../../core/sim/action-queue';
import { activeForeignFloor, activePlayerPosition, advanceActivePlayer } from '../../core/sim/active-player';
import { findPath, isWalkable } from '../../core/sim/pathfinding';
import { movePlayer } from '../../core/sim/player';
import { createWorld } from '../../core/sim/templates';
import { tickWorld } from '../../core/sim/tick';
import type { Point, WorldState } from '../../core/sim/types';
import { worldNav } from '../../core/sim/world';
import { randomSeed } from '../../test/random-seed';
import { visitForeignCmd } from '../foreign-floor-commands';
import { replaySave, toSavedGame } from '../save';
import { buildView } from '../snapshot';

function visit(): { world: ReturnType<typeof createWorld>; floor: NonNullable<ReturnType<typeof activeForeignFloor>> } {
  const world = createWorld('SMALL');
  visitForeignCmd(world, 'HAFENKLAUSE');
  const floor = activeForeignFloor(world);
  if (!floor) throw new Error('Foreign Floor fehlt.');
  return { world, floor };
}

/** Ein freies Ziel mit echtem Laufweg, damit kein Test an einer Wand haengt. */
function routeTarget(world: ReturnType<typeof createWorld>): { point: Point; path: Point[] } {
  const nav = worldNav(world);
  const start = activePlayerPosition(world);
  for (let radius = 2; radius < 8; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const point = { x: start.x + dx, y: start.y + dy };
        if (!isWalkable(nav, point.x, point.y)) continue;
        const path = findPath(nav, start, point);
        if (path.length >= 3) return { point, path };
      }
    }
  }
  throw new Error('Kein freies Laufziel auf dem foreign Floor.');
}

describe('Fremder Floor ist begehbar', () => {
  it('bewegt den foreign-eigenen Spieler im Welt-Tick und laesst den eigenen Stand stehen', () => {
    const { world, floor } = visit();
    const ownStart = { ...world.player.position };
    const target = routeTarget(world);
    movePlayer(world, target.point);

    expect(floor.playerPath).toEqual(target.path);
    expect(world.player.path).toHaveLength(0);
    const first = floor.playerPath[0]!;

    tickWorld(world, new Ledger(), new Prng(randomSeed()));

    expect(floor.playerPosition).toEqual(first);
    expect(world.player.position).toEqual(ownStart);

    advanceActivePlayer(world, 99);
    expect(floor.playerPosition).toEqual(target.point);
  });

  it('fuehrt den Maus-/Touch-Auftrag MOVE_HERE auf dem foreign Floor aus', () => {
    const { world, floor } = visit();
    const target = routeTarget(world);
    enqueueTask(world, { kind: 'MOVE', point: target.point });

    for (let tick = 0; tick <= target.path.length + 3; tick += 1) {
      tickActionQueue(world, new Ledger());
      advanceActivePlayer(world, 1);
    }

    expect(floor.playerPosition).toEqual(target.point);
    expect(world.player.path).toHaveLength(0);
    expect(world.actionQueue.tasks).toHaveLength(0);
    expect(world.actionQueue.last?.status).toBe('COMPLETED');
  });

  it('liest Groesse und Spieler aus dem foreign-Floor-Snapshot, nicht aus dem eigenen Casino', () => {
    const { world, floor } = visit();
    const target = routeTarget(world);
    movePlayer(world, target.point);
    advanceActivePlayer(world, 99);
    // Eine falsch gespiegelte Groesse darf den echten foreign-Plan nicht ersetzen.
    const misleading: WorldState = {
      ...world,
      activeForeignFloorId: 9999,
      scene: { kind: 'FOREIGN', foreignFloorId: 9999 },
      foreignFloors: [{ ...floor, id: 9999, size: 999 }],
    };

    const view = buildView(misleading, new Ledger(), '');
    expect(view.scene.kind).toBe('FOREIGN');
    expect(view.size).toBe(floor.layout!.size);
    expect(view.player.position).toEqual(target.point);
    expect(view.player.path.at(-1)).toEqual(target.point);
    expect(view.player.pathIndex).toBe(view.player.path.length);
  });

  it('behaelt Position und Szene im Save-/Load-Roundtrip', () => {
    const { world, floor } = visit();
    const target = routeTarget(world);
    movePlayer(world, target.point);
    advanceActivePlayer(world, 99);

    const raw = JSON.parse(JSON.stringify(toSavedGame(world, new Ledger(), 4242))) as Record<string, unknown>;
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.scene.kind).toBe('FOREIGN');
    const loadedFloor = activeForeignFloor(loaded!.world);
    expect(loadedFloor).not.toBeNull();
    expect(loadedFloor!.id).toBe(floor.id);
    expect(loadedFloor!.playerPosition).toEqual(target.point);
  });
});
