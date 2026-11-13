/**
 * @test-target: src/store/scene-commands.ts
 * @error-code: ERR-2001
 *
 * Der erste Schritt vor die Tür füllt die Stadt: Die drei kuratierten Figuren
 * sind der Anfang, nicht das Ende. Jeder Neue bekommt in derselben Sekunde ein
 * Profil und eine Schicht, und ein zweiter Weg auf die Straße verdoppelt
 * niemanden.
 */
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';
import { ensureCityLife } from '../../core/sim/city-life-state';
import { CITY_POPULATION_DEFAULT, CITY_POPULATION_STREET } from '../../core/sim/city-npc-roster';
import { slotOf } from '../../core/sim/city-npc-shift';

function setup(): { world: ReturnType<typeof createNewGame>['world']; scene: SceneCommands } {
  const { world } = createNewGame('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} });
  scene.finishOpening();
  return { world, scene };
}

describe('Bevölkerung auf der Straße', () => {
  it('wächst beim Betreten der Straße über die kuratierten drei hinaus', () => {
    const { world, scene } = setup();
    expect(ensureCityLife(world).residents).toHaveLength(CITY_POPULATION_DEFAULT);
    scene.enterCity();
    expect(world.cityLife?.residents).toHaveLength(CITY_POPULATION_STREET);
  });

  it('gibt jedem neuen Bewohner ein Profil und eine Schicht', () => {
    const { world, scene } = setup();
    scene.enterCity();
    const residents = ensureCityLife(world).residents;
    const profileIds = residents.map((resident) => resident.visitorId);
    expect(new Set(profileIds).size).toBe(CITY_POPULATION_STREET);
    for (const resident of residents) {
      const profile = world.visitors.find((visitor) => visitor.id === resident.visitorId);
      expect(profile?.residentNpcId).toBe(resident.npcId);
      expect(slotOf(resident.npcId)?.holderId).toBe(resident.npcId);
    }
  });

  it('bleibt beim zweiten Weg auf die Straße bei derselben Besetzung', () => {
    const { world, scene } = setup();
    scene.enterCity();
    const ids = ensureCityLife(world).residents.map((resident) => resident.npcId);
    const visitors = world.visitors.length;
    scene.enterCity();
    expect(world.cityLife?.residents.map((resident) => resident.npcId)).toEqual(ids);
    expect(world.visitors).toHaveLength(visitors);
  });
});
