/**
 * @test-target: src/core/sim/city-network.ts
 * @error-code: ERR-2001
 *
 * Das Stadtnetz ist die einzige Zielwahrheit: vier Knoten haengen ueber je eine
 * Tuerkante an der Strasse, jede Layout-Tuer ist genau eine Netzkante, und jeder
 * Szenen-/Ortswechsel im Spielpfad laeuft ueber diese Kante.
 */
import { describe, expect, it } from 'vitest';
import { createCityStreetLayout } from '../city-exterior';
import {
  CITY_NETWORK_HUB,
  CITY_NETWORK_NODES,
  CITY_STREET_DOOR_IDS,
  cityDoorEffect,
  cityNetworkEdge,
  cityNetworkEdges,
  cityNetworkTargets,
} from '../city-network';
import { cityOf } from '../city-model';
import { createWorld } from '../templates';
import { SceneCommands } from '../../../store/scene-commands';

function world() {
  return createWorld('SMALL');
}

function sceneFor(state: ReturnType<typeof world>) {
  return new SceneCommands({
    world: () => state,
    emit: () => undefined,
    notice: () => undefined,
  });
}

/** An die Schwelle stellen; der Wechsel wirkt nur in Reichweite (#506). */
function at(state: ReturnType<typeof world>, doorId: string) {
  const layout = state.scene.kind === 'CITY' ? state.cityScene!.layout : state.layout;
  const edge = layout.edges.find((entry) => entry.kind === 'DOOR' && entry.id === doorId);
  if (!edge) throw new Error(`Tuer fehlt im Layout: ${doorId}`);
  state.player.position = { x: edge.x, y: edge.y };
  state.player.path = [];
}

describe('Stadtnetz', () => {
  it('verbindet die Strasse als Verteiler mit allen vier Orten', () => {
    expect(cityNetworkTargets().slice().sort()).toEqual(['APARTMENT', 'CASINO', 'KIEZ', 'MARKT']);
    expect(CITY_NETWORK_NODES[0]!.id).toBe(CITY_NETWORK_HUB);
    // Jeder Zielknoten traegt genau eine Tuer; die Strasse selbst keine.
    for (const node of CITY_NETWORK_NODES) {
      const edges = cityNetworkEdges().filter((edge) => edge.to === node.id);
      expect(edges.length, node.id).toBe(node.hasDoor ? 1 : 0);
    }
  });

  it('deckt jede Tuer des Stadt-Layouts genau einmal und leitet die Wirkung daraus ab', () => {
    const layout = createCityStreetLayout();
    const layoutDoors = layout.edges
      .filter((edge) => edge.kind === 'DOOR' && edge.id !== null)
      .map((edge) => edge.id!);
    expect(layoutDoors.slice().sort()).toEqual(cityNetworkEdges().map((edge) => edge.doorId).slice().sort());
    expect(new Set(CITY_STREET_DOOR_IDS).size).toBe(CITY_STREET_DOOR_IDS.length);
    for (const edge of cityNetworkEdges()) {
      expect(edge.from, edge.doorId).toBe(CITY_NETWORK_HUB);
      expect(cityNetworkEdge(edge.doorId), edge.doorId).toBe(edge);
      expect(cityDoorEffect(edge.doorId), edge.doorId).toBe(edge.effect);
    }
    expect(cityNetworkEdge('door_street_to_unknown')).toBeNull();
    expect(cityDoorEffect('door_street_to_unknown')).toBeNull();
  });

  it('fuehrt jeden Ortswechsel ueber die passende Netzkante', () => {
    const state = world();
    const scene = sceneFor(state);
    scene.enterCity();
    expect(state.scene.kind).toBe('CITY');
    // Der Markt braucht den Kiez-Rang; das ist eine Ortsregel, keine Netzkante.
    state.city = { ...cityOf(state), KIEZ: 9 };

    // Kiez und Markt öffnen ihren Innenraum; die Straße bleibt der Verteiler.
    const expectedReturn = {
      APARTMENT: 'APARTMENT', CASINO: 'CASINO', KIEZ: 'INTERIOR', MARKT: 'INTERIOR',
    } as const;
    const expectedScene = {
      APARTMENT: 'APARTMENT', CASINO: 'OWN', KIEZ: 'INTERIOR', MARKT: 'INTERIOR',
    } as const;

    for (const edge of cityNetworkEdges()) {
      expect(state.scene.kind, edge.doorId).toBe('CITY');
      at(state, edge.doorId);
      expect(scene.enterStreetDoor(edge.doorId), edge.doorId).toBe(expectedReturn[edge.to]);
      expect(state.scene.kind, edge.doorId).toBe(expectedScene[edge.to]);
      if (edge.to === 'KIEZ' || edge.to === 'MARKT') {
        expect(state.city?.location, edge.doorId).toBe(edge.to);
      }
      scene.enterCity();
    }
  });
});
