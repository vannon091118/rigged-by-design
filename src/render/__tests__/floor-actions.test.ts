/**
 * @test-target: src/render/floor-actions.ts
 * @error-code: ERR-3001
 *
 * Der Lager-Spiegel ist die einzige Deko mit einer Charaktereditor-Aktion;
 * normale Deko darf keine versteckte Sonderaktion bekommen.
 */
import { describe, expect, it } from 'vitest';
import { playerApartmentFurniture } from '../../core/sim/player-apartment';
import { createWorld } from '../../core/sim/templates';
import { buildFurnitureActions } from '../floor-actions';

describe('Deko-Aktionen', () => {
  it('der Spiegel im Lager öffnet den Charaktereditor', () => {
    const world = createWorld('SMALL');
    const mirror = world.furniture.find((item) => item.kind === 'DECOR' && item.label === 'Spiegel');
    if (!mirror) throw new Error('Spiegel fehlt im Blueprint');
    const actions = buildFurnitureActions(world, mirror);
    expect(actions[0]).toMatchObject({ id: 'SPIEGEL', label: 'Spiegel', enabled: true });
  });

  it('normale Deko bleibt ohne Spiegel-Aktion', () => {
    const world = createWorld('SMALL');
    const plant = world.furniture.find((item) => item.label === 'Pflanze');
    if (!plant) throw new Error('Pflanze fehlt im Blueprint');
    const actions = buildFurnitureActions(world, plant);
    expect(actions.some((action) => action.id === 'SPIEGEL')).toBe(false);
  });

  it('erkennt Sonderaktionen über stabile artId, auch bei geänderten Labels', () => {
    const world = createWorld('SMALL');
    const view = { player: world.player, scene: { kind: 'APARTMENT' as const } };
    const apartment = playerApartmentFurniture();
    const byArt = (artId: string) => {
      const item = apartment.find((entry) => entry.artId === artId);
      if (!item) throw new Error(`Wohnungsmöbel ${artId} fehlt`);
      return { ...item, label: `umbenannt:${artId}` };
    };
    const blueprintMirror = world.furniture.find((item) => item.label === 'Spiegel');
    const plant = world.furniture.find((item) => item.label === 'Pflanze');
    if (!blueprintMirror || !plant) throw new Error('Blueprint-Deko fehlt');

    expect(buildFurnitureActions(view, { ...blueprintMirror, artId: 'decor:mirror' }).some((action) => action.id === 'SPIEGEL')).toBe(true);
    expect(buildFurnitureActions(view, byArt('apartment:sink')).some((action) => action.id === 'SPIEGEL')).toBe(true);
    expect(buildFurnitureActions(view, byArt('apartment:fridge')).some((action) => action.id === 'DRINK_AT_HOME')).toBe(true);
    expect(buildFurnitureActions(view, byArt('apartment:kitchen_counter')).some((action) => action.id === 'EAT_AT_HOME')).toBe(true);

    const mislabeledPlant = { ...plant, artId: 'apartment:table', label: 'Spiegel' };
    expect(buildFurnitureActions(view, mislabeledPlant).some((action) => action.id === 'SPIEGEL')).toBe(false);
  });
});
