/**
 * @test-target: src/store/new-game.ts
 * @error-code: ERR-2001
 *
 * Ein neuer Start beginnt mit der Eroeffnung; danach steht die Stadt offen, aber
 * die Kasse bleibt im leeren Casino: ohne sie gibt es keinen ersten Gast.
 */
import { describe, expect, it } from 'vitest';
import { exchangePoint } from '../../core/sim/world';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';

describe('Neues Spiel', () => {
  it('haelt die Kasse fuer den ersten Gast bereit', () => {
    const { world } = createNewGame('SMALL');
    expect(world.scene.kind).toBe('CITY');
    expect(world.onboarding?.step).toBe('OPENING');
    expect(world.furniture.map((item) => item.kind)).toEqual(['EXCHANGE']);
    expect(world.furniture.some((item) => item.gameId)).toBe(false);
    expect(exchangePoint(world)).not.toBeNull();
    expect(world.guests).toHaveLength(0);
    expect(world.nextGuestId).toBe(1);

    // Erst die Eroeffnung gibt die Stadt frei; die Kasse bleibt dabei stehen.
    new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} }).finishOpening();
    expect(world.onboarding?.step).toBe('CITY');
    expect(exchangePoint(world)).not.toBeNull();
  });
});
