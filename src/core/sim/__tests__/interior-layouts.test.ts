/**
 * @test-target: src/core/sim/interior-layouts.ts
 * @error-code: ERR-2001
 *
 * Kneipe und Späti sind echte, begehbare Innenräume: eigener Grundriss, eine
 * Straßentür, erreichbare Möbel und ein Rückweg auf dieselbe Schwelle. Der
 * Türübergang nutzt dieselbe Szene wie das Spiel, keinen zweiten Zustand.
 */
import { describe, expect, it } from 'vitest';
import { interiorDef, interiorLayouts, type InteriorDef } from '../interior-layouts';
import { navGrid, stepOpen, tileIndex } from '../nav-grid';
import { cityOf } from '../city-model';
import { createWorld } from '../templates';
import { SceneCommands } from '../../../store/scene-commands';

function reachable(room: InteriorDef): Set<number> {
  const nav = navGrid(room.layout.size, room.furniture, room.layout);
  const size = room.layout.size;
  const seen = new Set<number>([tileIndex(size, room.spawn.x, room.spawn.y)]);
  const queue = [{ ...room.spawn }];
  while (queue.length > 0) {
    const at = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: at.x + dx, y: at.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size) continue;
      const index = tileIndex(size, next.x, next.y);
      if (seen.has(index) || nav.blocked.has(index)) continue;
      if (!stepOpen(nav, at, next)) continue;
      seen.add(index);
      queue.push(next);
    }
  }
  return seen;
}

describe('Stadt-Innenräume', () => {
  it('definiert genau Kneipe und Späti mit eigenem Grundriss', () => {
    expect(interiorLayouts().map((entry) => entry.layoutId).sort()).toEqual(['layout_corner_shop', 'layout_kiez_pub']);
    expect(interiorDef('layout_kiez_pub')?.buildingId).toBe('bld_kiez_pub');
    expect(interiorDef('layout_corner_shop')?.buildingId).toBe('bld_corner_shop');
    expect(interiorDef('layout_unknown')).toBeNull();
    expect(interiorDef(undefined)).toBeNull();
  });

  it('umschließt jeden Raum mit Wänden und hält die Straßentür offen', () => {
    for (const room of interiorLayouts()) {
      const size = room.layout.size;
      const doors = room.layout.edges.filter((edge) => edge.kind === 'DOOR');
      expect(doors.map((edge) => edge.id), room.layoutId).toEqual(['door_interior_exit']);
      expect(doors[0]!.axis).toBe('H');
      expect(doors[0]!.x).toBe(room.exitTile.x);
      expect(doors[0]!.y).toBe(size === room.layout.size ? 10 : 10);
      const walls = room.layout.edges.filter((edge) => edge.kind === 'WALL');
      expect(walls.length, room.layoutId).toBeGreaterThanOrEqual(40);
      expect(room.spawn).not.toEqual(room.exitTile);
      expect(room.layout.floor.length).toBe(size * 10);
    }
  });

  it('erreicht von der Tür aus jedes Möbel und die Ausgangskachel', () => {
    for (const room of interiorLayouts()) {
      const seen = reachable(room);
      const size = room.layout.size;
      expect(seen.has(tileIndex(size, room!.exitTile.x, room!.exitTile.y)), room!.layoutId).toBe(true);
      for (const item of room!.furniture) {
        const around = [
          { x: item.x + item.w, y: item.y },
          { x: item.x - 1, y: item.y },
          { x: item.x, y: item.y + item.h },
          { x: item.x, y: item.y - 1 },
        ];
        const open = around.some((point) =>
          point.x >= 0 && point.y >= 0 && point.x < size && point.y < 11
          && seen.has(tileIndex(size, point.x, point.y)));
        expect(open, `${room!.layoutId}:${item.label}`).toBe(true);
      }
    }
  });

  it('öffnet Kneipe und Späti als Szene und führt über die Tür zurück', () => {
    const world = createWorld('SMALL');
    const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
    scene.enterCity();
    world.city = { ...cityOf(world), KIEZ: 9 };

    for (const room of interiorLayouts()) {
      const doorId = room.kind === 'PUB' ? 'door_street_to_kiez_pub' : 'door_street_to_corner_shop';
      const door = world.cityScene!.layout.edges.find((edge) => edge.id === doorId)!;
      world.player.position = { x: door.x, y: door.y };
      world.player.path = [];
      expect(scene.enterStreetDoor(doorId), doorId).toBe('INTERIOR');
      expect(world.scene.kind).toBe('INTERIOR');
      expect(world.scene.interior).toEqual({
        buildingId: room.buildingId, layoutId: room.layoutId, name: room.name,
      });
      expect(world.player.position).toEqual(room.spawn);
      expect(world.city?.location).toBe(room.kind === 'PUB' ? 'KIEZ' : 'MARKT');

      world.player.position = { ...room.exitTile };
      expect(scene.leaveInteriorAtDoor()).toBe(true);
      expect(world.scene.kind).toBe('CITY');
      expect(world.player.position).toEqual(room.streetDoor);
    }
  });
});
