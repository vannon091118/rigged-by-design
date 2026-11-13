/** @test-target: src/core/sim/player-apartment.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { playerApartmentFurniture, playerApartmentModel } from '../player-apartment';
import { navGrid, stepOpen, tileIndex } from '../nav-grid';
import { createWorld } from '../templates';
import { buildView } from '../../../store/snapshot';
import { resolveFurnitureRole } from '../../../render/decor-roles';
import { isApartmentFurniture } from '../../../render/apartment-furniture-art';
import { floorTextureKey } from '../../../render/floor-material';

function apartmentView() {
  const world = createWorld('MEDIUM');
  world.scene = { kind: 'APARTMENT' };
  return buildView(world, new Ledger(), '');
}

/** Alle vom Bett aus begehbaren Tiles; Wände und Möbel blockieren, Türen nicht. */
function reachableFromBed(): Set<number> {
  const model = playerApartmentModel();
  const size = model.layout.size;
  const nav = navGrid(size, playerApartmentFurniture(), model.layout);
  const seen = new Set<number>([tileIndex(size, model.bedSpawn.x, model.bedSpawn.y)]);
  const queue = [{ ...model.bedSpawn }];
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

describe('Wohnungs-Renderabnahme', () => {
  it('projiziert die kanonische Wohnung mit ihren fünf Bereichen', () => {
    const view = apartmentView();
    expect(view.scene.kind).toBe('APARTMENT');
    expect(view.zones.map((zone) => zone.id)).toEqual([
      'apt_zone_bedroom', 'apt_zone_living', 'apt_zone_bathroom', 'apt_zone_kitchen', 'apt_zone_hallway',
    ]);
    expect(view.layout.size).toBe(playerApartmentModel().layout.size);
  });

  it('gibt jedem Wohnungsmöbel eine stabile Rolle und keine Casino-Spiel-ID', () => {
    const view = apartmentView();
    expect(view.furniture.length).toBeGreaterThanOrEqual(9);
    for (const item of view.furniture) {
      expect(resolveFurnitureRole(item), item.label).not.toBeNull();
      expect(item.gameId, item.label).toBeUndefined();
    }
  });

  it('nutzt die warme Wohnungspalette mit echten Texturen', () => {
    expect(floorTextureKey('CARPET', 'apartment')).toBe('environment/floor/apartment-rug.svg');
    expect(floorTextureKey('WOOD', 'apartment')).toBe('environment/floor/wood-planks.svg');
  });

  it('umschließt alle fünf Bereiche mit Wänden und lässt Türen offen', () => {
    const layout = playerApartmentModel().layout;
    expect(layout.edges.filter((edge) => edge.kind === 'WALL').length).toBeGreaterThanOrEqual(20);
    // Jede Zone hat mindestens eine Wandkante an ihrer Grenze.
    for (const zone of layout.zones) {
      const enclosed = layout.edges.some((edge) => {
        if (edge.kind !== 'WALL') return false;
        const touching = edge.axis === 'H'
          ? edge.y === zone.y || edge.y === zone.y + zone.h
          : edge.x === zone.x || edge.x === zone.x + zone.w;
        const inSpan = edge.axis === 'H'
          ? edge.x >= zone.x && edge.x < zone.x + zone.w
          : edge.y >= zone.y && edge.y < zone.y + zone.h;
        return touching && inSpan;
      });
      expect(enclosed, zone.id).toBe(true);
    }
  });

  it('blockiert Wände, hält aber alle Übergänge begehbar', () => {
    const model = playerApartmentModel();
    const nav = navGrid(model.layout.size, playerApartmentFurniture(), model.layout);
    const step = (from: [number, number], to: [number, number]) =>
      stepOpen(nav, { x: from[0], y: from[1] }, { x: to[0], y: to[1] });
    // Querwand: Wand bei x=5, Tür bei x=4, Durchgang Wohnen↔Flur bei x=11.
    expect(step([5, 7], [5, 8])).toBe(false);
    expect(step([4, 7], [4, 8])).toBe(true);
    expect(step([11, 7], [11, 8])).toBe(true);
    // Schlafen↔Wohnen nur durch den bestehenden Durchgang.
    expect(step([7, 5], [8, 5])).toBe(true);
    expect(step([7, 4], [8, 4])).toBe(false);
    // Küche nur durch ihre Tür.
    expect(step([10, 10], [9, 10])).toBe(true);
    expect(step([10, 9], [9, 9])).toBe(false);
  });

  it('hält jedes interaktive Möbel von der Wohnung aus erreichbar', () => {
    const model = playerApartmentModel();
    const reachable = reachableFromBed();
    const size = model.layout.size;
    for (const item of model.furniture.filter((entry) => entry.interactive)) {
      const around = [
        { x: item.position.x + 1, y: item.position.y },
        { x: item.position.x - 1, y: item.position.y },
        { x: item.position.x, y: item.position.y + 1 },
        { x: item.position.x, y: item.position.y - 1 },
      ];
      const open = around.some((point) =>
        point.x >= 0 && point.y >= 0 && point.x < size && point.y < size
        && reachable.has(tileIndex(size, point.x, point.y)));
      expect(open, item.name).toBe(true);
    }
  });

  it('bindet die Wohnungsmöbel an eigene Kunst-IDs statt an Casino-Assets', () => {
    const items = playerApartmentFurniture();
    expect(items.length).toBeGreaterThanOrEqual(9);
    for (const item of items) {
      expect(item.artId?.startsWith('apartment:'), item.label).toBe(true);
      expect(isApartmentFurniture(item), item.label).toBe(true);
      const role = resolveFurnitureRole(item);
      expect(role, item.label).not.toBeNull();
      expect(role!.asset, item.label).toBeNull();
    }
  });

  it('hält die Haustür am bestehenden Stadtübergang', () => {
    const model = playerApartmentModel();
    const door = model.layout.edges.find((edge) => edge.kind === 'DOOR' && edge.id === 'door_apt_exit_to_street');
    expect(door?.kind).toBe('DOOR');
    expect(door?.id).toBe('door_apt_exit_to_street');
    expect(model.exitDoor).toEqual({ x: 11, y: 13 });
  });
});
