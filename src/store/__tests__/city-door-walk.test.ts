/**
 * @test-target: src/store/scene-commands.ts
 * @error-code: ERR-2001
 *
 * Ein ferner Tuerklick ist ein Weg, kein Sprung: Der Spieler laeuft zur
 * Schwelle, und erst die Ankunft oeffnet die Tuer. Wer unterwegs woanders
 * stehen bleibt, verliert den Auftrag (#506).
 */
import { describe, expect, it } from 'vitest';
import { advanceActivePlayer } from '../../core/sim/active-player';
import { createWorld } from '../../core/sim/templates';
import { SceneCommands } from '../scene-commands';

function city(): { world: ReturnType<typeof createWorld>; scene: SceneCommands } {
  const world = createWorld('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
  scene.enterCity();
  world.player.position = { x: 1, y: 1 };
  world.player.path = [];
  world.player.pathIndex = 0;
  return { world, scene };
}

function runToEnd(world: ReturnType<typeof createWorld>, arrive: () => boolean): boolean {
  for (let tick = 0; tick < 400; tick += 1) {
    advanceActivePlayer(world, 1);
    if (arrive()) return true;
  }
  return false;
}

describe('Stadt: Weg zur Tuer statt Sprung', () => {
  it('schickt den Spieler zur Schwelle und oeffnet erst bei Ankunft', () => {
    const { world, scene } = city();
    const before = world.city?.location;
    expect(scene.enterStreetDoor('door_street_to_kiez_pub')).toBeNull();
    expect(world.scene.kind).toBe('CITY');
    expect(world.city?.location).toBe(before);
    expect(world.player.path.length).toBeGreaterThan(0);

    expect(runToEnd(world, () => scene.arriveAtStreetDoor())).toBe(true);
    expect(world.city?.location).toBe('KIEZ');
  });

  it('verliert den Auftrag, wenn der Weg woanders endet', () => {
    const { world, scene } = city();
    expect(scene.enterStreetDoor('door_street_to_kiez_pub')).toBeNull();
    // Der Spieler bricht ab und bleibt an einer anderen Kachel stehen.
    world.player.path = [{ x: 2, y: 2 }];
    world.player.pathIndex = 1;
    world.player.position = { x: 2, y: 2 };
    expect(scene.arriveAtStreetDoor()).toBe(false);
    expect(world.city?.location).not.toBe('KIEZ');
    // Ein zweiter Tick oeffnet die Tuer auch nicht nachtraeglich.
    expect(scene.arriveAtStreetDoor()).toBe(false);
  });

  it('laesst unbekannte Tueren ohne Weg und ohne Wirkung', () => {
    const { world, scene } = city();
    expect(scene.enterStreetDoor('door_street_to_unknown')).toBeNull();
    expect(world.player.path).toEqual([]);
  });
});
