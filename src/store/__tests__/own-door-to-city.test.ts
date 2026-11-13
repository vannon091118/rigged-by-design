/**
 * @test-target: src/store/scene-commands.ts
 * @error-code: ERR-2001
 *
 * Nach dem Onboarding traegt die eigene Haustuer den Rueckweg: sie steht im
 * Casino-Layout (`door-<zone>`), nicht in der Strassentabelle. Ohne diesen Weg
 * blieb der Spieler im eigenen Haus und kam nur per Reload auf die Strasse.
 * Der Austritt landet an der eigenen Schwelle, nicht am Wohnungseingang.
 */
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';

function setup(): { world: ReturnType<typeof createNewGame>['world']; scene: SceneCommands; ownDoor: string } {
  const { world } = createNewGame('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} });
  scene.finishOpening();
  scene.enterCity();
  scene.enterCasino();
  world.onboarding = { step: 'DONE' };
  const ownDoor = world.layout.edges.find((edge) => edge.kind === 'DOOR' && edge.id !== null)?.id ?? '';
  return { world, scene, ownDoor };
}

describe('Eigene Haustuer', () => {
  it('fuehrt aus dem Casino auf die Strasse, eine Kachel vor der Grand-Schwelle', () => {
    const { world, scene, ownDoor } = setup();
    expect(ownDoor).toMatch(/^door-/);
    expect(scene.enterStreetDoor(ownDoor)).toBe('CITY');
    expect(world.scene.kind).toBe('CITY');
    expect(world.player.position).toEqual({ x: 22, y: 23 });
    // Die Schwelle selbst bleibt die Tuer in der Strasse, nicht der Austrittspunkt.
    expect(world.player.position).not.toEqual({ x: 22, y: 22 });
  });

  it('laesst eine unbekannte Tuer-ID wirkungslos und die Szene stehen', () => {
    const { world, scene } = setup();
    expect(scene.enterStreetDoor('door_unbekannt')).toBeNull();
    expect(world.scene.kind).toBe('OWN');
  });

  it('fuehrt aus der Wohnung weiterhin an den Wohnungseingang', () => {
    const { world } = createNewGame('SMALL');
    const scene = new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} });
    scene.finishOpening();
    scene.enterCity();
    expect(world.player.position).toEqual({ x: 8, y: 13 });
  });
});
