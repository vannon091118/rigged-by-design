/**
 * @test-target: src/render/floor-actions.ts
 * @error-code: ERR-3001
 *
 * Der Lager-Spiegel ist die einzige Deko mit einer Charaktereditor-Aktion;
 * normale Deko darf keine versteckte Sonderaktion bekommen.
 */
import { describe, expect, it } from 'vitest';
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
});
