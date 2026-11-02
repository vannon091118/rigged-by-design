/** @test-target: src/core/sim/mugging.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { muggingCoverPoint } from '../mugging';
import { createWorld } from '../templates';

describe('Überfall: Deckung zählt an der Kasse', () => {
  it('misst die Deckung am Wechseltisch, nicht am Spieler', () => {
    const world = createWorld('SMALL');
    const till = world.furniture.find((item) => item.kind === 'EXCHANGE')!;
    world.player.position = { x: 1, y: 1 };
    expect(muggingCoverPoint(world)).toEqual({ x: till.x, y: till.y });
  });

  it('bleibt ohne Wechseltisch beim Spieler', () => {
    const world = createWorld('SMALL');
    world.furniture = world.furniture.filter((item) => item.kind !== 'EXCHANGE');
    world.player.position = { x: 4, y: 5 };
    expect(muggingCoverPoint(world)).toEqual({ x: 4, y: 5 });
  });
});
