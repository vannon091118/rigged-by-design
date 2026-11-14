/**
 * @test-target: src/render/floor-hit.ts
 * @error-code: ERR-4017
 *
 * Die vier Stadtkanten sind nur dann Tueren, wenn Treffer, Aktion und Uebergang
 * dieselbe ID lesen. Der Test klickt jede Schwelle ueber den normalen
 * Produktions-Snapshot und prueft danach den bestehenden Szenen-/Stadtwechsel.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { CITY_STREET_DOOR_IDS, cityDoorEffect } from '../../core/sim/city-doors';
import { cityOf } from '../../core/sim/city-model';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { buildView } from '../../store/snapshot';
import { SceneCommands } from '../../store/scene-commands';
import { buildDoorActions } from '../floor-actions';
import { resolveHit, type DoorEdge } from '../floor-hit';
import { handleTap } from '../floor-input';

function city() {
  const world = createWorld('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
  scene.enterCity();
  const view = buildView(world, new Ledger(), '');
  const doors: DoorEdge[] = view.layout.edges.flatMap((edge) => edge.kind === 'DOOR' && edge.id !== null
    ? [{ id: edge.id, axis: edge.axis, x: edge.x, y: edge.y }]
    : []);
  return { world, scene, view, doors };
}

const pixel = (door: DoorEdge) => ({ x: (door.x + 0.5) * TILE, y: (door.y + 0.5) * TILE });
const cues = () => ({ ping: () => undefined });

/** An die Schwelle stellen: Ein Tuerklick wirkt nur in Reichweite (#506). */
function at(world: ReturnType<typeof createWorld>, id: string) {
  const edges = world.scene.kind === 'CITY' ? world.cityScene!.layout.edges : world.layout.edges;
  const edge = edges.find((entry) => entry.kind === 'DOOR' && entry.id === id);
  if (!edge) return;
  world.player.position = { x: edge.x, y: edge.y };
  world.player.path = [];
}

describe('Stadt: Tuerkanten als Klickziel', () => {
  it('ordnet alle vier Stadtkanten ihren bestehenden Uebergaengen zu', () => {
    const { doors } = city();
    expect(doors.map((door) => door.id)).toEqual([...CITY_STREET_DOOR_IDS]);
    expect(cityDoorEffect('door_street_to_player_apt')).toEqual({ kind: 'APARTMENT' });
    expect(cityDoorEffect('door_street_to_casino_grand')).toEqual({ kind: 'CASINO' });
    expect(cityDoorEffect('door_street_to_kiez_pub')).toEqual({ kind: 'CITY_LOCATION', location: 'KIEZ' });
    expect(cityDoorEffect('door_street_to_corner_shop')).toEqual({ kind: 'CITY_LOCATION', location: 'MARKT' });
    expect(cityDoorEffect('door_street_to_unknown')).toBeNull();
  });

  it('trifft die Schwelle auf ihrer Besitzer-Kachel', () => {
    const { view, doors } = city();
    for (const door of doors) {
      const hit = resolveHit(view, { x: door.x, y: door.y }, view.player.position, doors);
      expect(hit, door.id).toMatchObject({ kind: 'door', id: door.id });
    }
  });

  it('macht aus dem Schwellenklick eine Tueraktion mit Ziel', () => {
    const { view, doors } = city();
    const byId = new Map(doors.map((door) => [door.id, door] as const));
    for (const id of CITY_STREET_DOOR_IDS) {
      const tap = handleTap(0, pixel(byId.get(id)!), view, cues());
      expect(tap?.target).toEqual({ kind: 'door', id });
      expect(tap?.actions[0]).toMatchObject({ id: 'ENTER_DOOR', doorId: id });
    }
    expect(handleTap(0, pixel(byId.get(CITY_STREET_DOOR_IDS[0])!), view, cues())?.actions[0]?.enabled).toBe(true);
    expect(handleTap(0, pixel(byId.get('door_street_to_corner_shop')!), view, cues())?.actions[0]).toMatchObject({
      enabled: false,
      reason: expect.stringContaining('Markt'),
    });
  });

  it('baut fuer jede Kante eine Aktion und oeffnet den Markt erst mit dem Kiez-Rang', () => {
    const { world, view, doors } = city();
    for (const door of doors) expect(buildDoorActions(view, door.id), door.id).toHaveLength(1);
    expect(buildDoorActions(view, 'door_street_to_corner_shop')[0]).toMatchObject({ enabled: false });
    world.city = { ...cityOf(world), KIEZ: 9 };
    const unlocked = buildView(world, new Ledger(), '');
    expect(buildDoorActions(unlocked, 'door_street_to_corner_shop')[0]?.enabled).toBe(true);
  });

  it('fuehrt die Schwelle in die bestehende Szene oder den Stadtort', () => {
    const { world, scene } = city();
    at(world, 'door_street_to_player_apt');
    expect(scene.enterStreetDoor('door_street_to_player_apt')).toBe('APARTMENT');
    expect(world.scene.kind).toBe('APARTMENT');
    scene.enterCity();
    at(world, 'door_street_to_casino_grand');
    expect(scene.enterStreetDoor('door_street_to_casino_grand')).toBe('CASINO');
    expect(world.scene.kind).toBe('OWN');
    scene.enterCity();
    at(world, 'door_street_to_kiez_pub');
    expect(scene.enterStreetDoor('door_street_to_kiez_pub')).toBe('INTERIOR');
    expect(world.scene.kind).toBe('INTERIOR');
    expect(world.city?.location).toBe('KIEZ');
    // Zurück auf die Straße; der Markt öffnet erst mit dem Kiez-Rang.
    scene.enterCity();
    expect(world.scene.kind).toBe('CITY');
    at(world, 'door_street_to_corner_shop');
    expect(scene.enterStreetDoor('door_street_to_corner_shop')).toBeNull();
    expect(world.city?.location).toBe('KIEZ');
    world.city = { ...cityOf(world), KIEZ: 9 };
    at(world, 'door_street_to_corner_shop');
    expect(scene.enterStreetDoor('door_street_to_corner_shop')).toBe('INTERIOR');
    expect(world.scene.kind).toBe('INTERIOR');
    expect(world.city?.location).toBe('MARKT');
    // Unbekannte Tuer bleibt wirkungslos; sie hat keine Kachel zum Hingehen.
    expect(scene.enterStreetDoor('door_street_to_unknown')).toBeNull();
  });

  it('schickt bei einem Klick ausserhalb der Reichweite erst den Weg zur Schwelle', () => {
    const { world, scene } = city();
    world.player.position = { x: 1, y: 1 };
    const notices: string[] = [];
    const guarded = new SceneCommands({
      world: () => world, emit: () => undefined, notice: (text) => notices.push(text),
    });
    expect(guarded.enterStreetDoor('door_street_to_player_apt')).toBeNull();
    expect(world.scene.kind).toBe('CITY');
    expect(notices.join(' ')).toMatch(/gehst zur Tür/);
    expect(world.player.path.length).toBeGreaterThan(0);
    void scene;
  });
});
