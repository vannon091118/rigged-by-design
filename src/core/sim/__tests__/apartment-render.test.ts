/** @test-target: src/core/sim/player-apartment.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { playerApartmentModel } from '../player-apartment';
import { createWorld } from '../templates';
import { buildView } from '../../../store/snapshot';
import { resolveFurnitureRole } from '../../../render/decor-roles';
import { floorTextureKey } from '../../../render/floor-material';

function apartmentView() {
  const world = createWorld('MEDIUM');
  world.scene = { kind: 'APARTMENT' };
  return buildView(world, new Ledger(), '');
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

  it('hält die Haustür am bestehenden Stadtübergang', () => {
    const model = playerApartmentModel();
    const door = model.layout.edges.find((edge) => edge.kind === 'DOOR' && edge.id === 'door_apt_exit_to_street');
    expect(door?.kind).toBe('DOOR');
    expect(door?.id).toBe('door_apt_exit_to_street');
    expect(model.exitDoor).toEqual({ x: 11, y: 13 });
  });
});
