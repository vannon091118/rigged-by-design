/**
 * @test-target: src/store/save.ts | src/store/scene-commands.ts
 * @error-code: ERR-1002
 *
 * Die Kette Laden -> Sicht -> Begegnung: Ein Save, der bereits in der Stadt
 * steht, muss beim Laden die Strassenbesetzung tragen. Vor #496 hatte ein
 * solcher Save nur die kuratierten drei Bewohner; `enterCity` stieg wegen der
 * bestehenden CITY-Szene aus, und kein Tick oder Snapshot holte das nach.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { meetNpc } from '../../core/sim/city-encounter';
import { CITY_POPULATION_DEFAULT, CITY_POPULATION_STREET } from '../../core/sim/city-npc-roster';
import { createWorld } from '../../core/sim/templates';
import type { WorldState } from '../../core/sim/types';
import { loadWorld, saveWorld } from '../save';
import { SceneCommands } from '../scene-commands';
import { buildView } from '../snapshot';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  const storage: Storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
});

/** Ein Save vor #496: Szene CITY, aber ohne `cityLife`-Feld. */
function legacyCityWorld(): WorldState {
  const world = createWorld('SMALL');
  world.scene = { kind: 'CITY' };
  world.cityLife = undefined as unknown as WorldState['cityLife'];
  return world;
}

describe('Geladener CITY-Save', () => {
  it('hebt die Dreierbesetzung beim Laden auf die Strassenbesetzung und bleibt ansprechbar', () => {
    const world = legacyCityWorld();
    expect(saveWorld(world, new Ledger(), 7)).toBe(true);

    const loaded = loadWorld();
    expect(loaded).not.toBeNull();
    expect(loaded!.world.scene.kind).toBe('CITY');
    expect(loaded!.world.cityLife.residents).toHaveLength(CITY_POPULATION_STREET);
    expect(loaded!.world.cityLife.residents.length).toBeGreaterThan(CITY_POPULATION_DEFAULT);
    expect(loaded!.world.cityLife.residents.every((resident) => resident.visitorId !== null)).toBe(true);

    const view = buildView(loaded!.world, loaded!.ledger, '');
    expect(view.city.residents).toHaveLength(CITY_POPULATION_STREET);
    const target = view.city.residents[view.city.residents.length - 1]!;
    expect(target.traits.length).toBeGreaterThan(0);

    const met = meetNpc(loaded!.world, target.npcId);
    expect(met.npc.id).toBe(target.npcId);
    expect(met.visitor.residentNpcId).toBe(target.npcId);
    expect(loaded!.world.visitors.some((visitor) => visitor.id === met.visitor.id && visitor.residentNpcId === target.npcId)).toBe(true);
  });

  it('hebt auch beim erneuten Betreten einer bestehenden CITY-Szene nach', () => {
    const world = legacyCityWorld();
    const scene = new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} });

    scene.enterCity();

    expect(world.scene.kind).toBe('CITY');
    expect(world.cityLife.residents).toHaveLength(CITY_POPULATION_STREET);
    expect(world.cityLife.residents.every((resident) => resident.visitorId !== null)).toBe(true);
  });
});
