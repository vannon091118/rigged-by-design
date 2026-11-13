/**
 * @test-target: src/store/snapshot.ts
 * @error-code: ERR-2001
 *
 * Stadtbewohner sind Figuren, keine Popup-Zeilen: Der Snapshot liefert sie mit
 * stabiler Kennung, Position und Reisestatus an den Renderer — und nur in der
 * Stadt (#505).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { ensureCityLife, ensureCityPopulation } from '../../core/sim/city-life-state';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { buildView } from '../snapshot';

function city() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  ensureCityPopulation(world, 12);
  world.scene = { kind: 'CITY' };
  return world;
}

describe('Stadtfiguren im Snapshot', () => {
  it('liefert jeden Bewohner mit Kennung und Simulationsposition', () => {
    const world = city();
    const view = buildView(world, new Ledger(), '');
    const life = ensureCityLife(world);
    expect(view.cityActors).toHaveLength(life.residents.length);
    for (const resident of life.residents) {
      const actor = view.cityActors.find((entry) => entry.npcId === resident.npcId);
      expect(actor, resident.npcId).toMatchObject({
        name: resident.name,
        x: resident.position.x,
        y: resident.position.y,
        traveling: resident.travel !== null,
      });
    }
  });

  it('folgt einer veraenderten Position und meldet den Reisestatus', () => {
    const world = city();
    const life = ensureCityLife(world);
    world.cityLife = {
      ...life,
      residents: life.residents.map((resident) => resident.npcId === 'rita'
        ? {
          ...resident, position: { x: 22, y: 18 },
          travel: { to: 'KIEZ' as const, path: [{ x: 22, y: 18 }], index: 0 },
        }
        : resident),
    };
    const actor = buildView(world, new Ledger(), '').cityActors.find((entry) => entry.npcId === 'rita')!;
    expect(actor).toMatchObject({ x: 22, y: 18, traveling: true });
  });

  it('liefert ausserhalb der Stadt keine Strassenfiguren', () => {
    const world = city();
    world.scene = { kind: 'APARTMENT' };
    expect(buildView(world, new Ledger(), '').cityActors).toEqual([]);
  });
});
