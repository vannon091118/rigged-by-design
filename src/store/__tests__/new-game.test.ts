/**
 * @test-target: src/store/new-game.ts
 * @error-code: ERR-2001
 *
 * Ein neues Spiel beginnt in der Wohnung; die Haustür führt auf die Straße, und
 * die Kasse bleibt im leeren Casino: ohne sie gibt es keinen ersten Gast.
 */
import { describe, expect, it } from 'vitest';
import { playerApartmentModel } from '../../core/sim/player-apartment';
import { exchangePoint } from '../../core/sim/world';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';
import { buildView } from '../snapshot';

describe('Neues Spiel', () => {
  it('startet in der Wohnung und haelt die Kasse fuer den ersten Gast bereit', () => {
    const { world } = createNewGame('SMALL');
    expect(world.scene.kind).toBe('APARTMENT');
    expect(world.player.position).toEqual(playerApartmentModel().bedSpawn);
    // Die Wohnung ist bewusst kleiner als ein Casino-Saal.
    expect(playerApartmentModel().layout.size).toBe(16);
    expect(world.onboarding?.step).toBe('OPENING');
    expect(world.furniture.map((item) => item.kind)).toEqual(['EXCHANGE']);
    expect(world.furniture.some((item) => item.gameId)).toBe(false);
    expect(exchangePoint(world)).not.toBeNull();
    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(1);

    // Erst die Eroeffnung gibt die Wohnung frei; die Kasse bleibt dabei stehen.
    new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} }).finishOpening();
    expect(world.onboarding?.step).toBe('APARTMENT');
    expect(exchangePoint(world)).not.toBeNull();
  });

  it('projiziert die Wohnung als eigene Szene mit ihrem Plan', () => {
    const { world, ledger } = createNewGame('SMALL');
    const view = buildView(world, ledger, '');
    const apartment = playerApartmentModel();

    expect(view.scene).toEqual({ key: 'APARTMENT', kind: 'APARTMENT', label: 'Wohnung' });
    expect(view.layout).toBe(apartment.layout);
    expect(view.size).toBe(apartment.layout.size);
    expect(view.player.position).toEqual(apartment.bedSpawn);
    expect(view.seats).toBe(0);
    expect(view.guests).toEqual([]);
    expect(view.crates).toEqual([]);
  });

  it('fuehrt ueber die Haustuer auf die Strasse und zurueck', () => {
    const { world } = createNewGame('SMALL');
    const scene = new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} });
    const apartment = playerApartmentModel();

    scene.finishOpening();
    scene.enterCity();
    expect(world.scene.kind).toBe('CITY');
    expect(world.onboarding?.step).toBe('CITY');

    scene.enterApartment();
    expect(world.scene.kind).toBe('APARTMENT');
    expect(world.onboarding?.step).toBe('APARTMENT');
    expect(world.player.position).toEqual({ x: apartment.exitDoor.x, y: apartment.exitDoor.y - 1 });

    // Die Schwelle selbst ist der Ausgang, nicht nur der Knopf im Panel.
    world.player.position = { ...playerApartmentModel().exitDoor };
    expect(scene.leaveApartmentAtDoor()).toBe(true);
    expect(world.scene.kind).toBe('CITY');
  });
});
