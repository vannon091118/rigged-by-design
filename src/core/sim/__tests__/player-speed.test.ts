/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Speed war einmal nur ein gespeicherter Attributwert. Dieser Test haelt fest,
 * dass die Stufe die Zahl der Pfadschritte pro Tick wirklich veraendert.
 * `findPath` liefert den Startknoten als `path[0]`; der ersteTick verbraucht
 * damit einen Schritt ohne Ortswechsel — gemessen wird deshalb `pathIndex`.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { movePlayer } from '../player';
import { playerStepsPerTick, type PlayerRpgState } from '../player-rpg';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import type { WorldState } from '../types';
import { canPlace } from '../world';
import { randomSeed } from '../../../test/random-seed';

const rpg = (speedLevel: number): PlayerRpgState =>
  ({ level: 1, xp: 0, unspentPoints: 0, speedLevel, charismaLevel: 0, brawlLevel: 0 });

/** Freie Reihe suchen, damit der Pfad nicht durch Moebel oder Zonenrand laeuft. */
function walkRow(steps: number): { world: WorldState; ledger: Ledger; prng: Prng } {
  const world = createWorld('MEDIUM');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  for (let y = 2; y < world.size - 2; y += 1) {
    for (let x = 2; x < world.size - steps - 2; x += 1) {
      if (!canPlace(world, x, y, 1, 1, true) || !canPlace(world, x + steps, y, 1, 1, true)) continue;
      world.player.position = { x, y };
      movePlayer(world, { x: x + steps, y });
      if (world.player.path.length > steps) return { world, ledger, prng };
    }
  }
  throw new Error('keine freie Reihe fuer den Bewegungstest');
}

describe('Speed als Bewegungsgroesse', () => {
  it('steigt erst ab Stufe 3 und ist ab Stufe 6 gedeckelt', () => {
    expect(playerStepsPerTick(rpg(0))).toBe(1);
    expect(playerStepsPerTick(rpg(2))).toBe(1);
    expect(playerStepsPerTick(rpg(3))).toBe(2);
    expect(playerStepsPerTick(rpg(6))).toBe(3);
    expect(playerStepsPerTick(rpg(40))).toBe(3);
  });

  it('verbraucht ohne Speed genau einen Pfadschritt pro Tick', () => {
    const { world, ledger, prng } = walkRow(5);
    tickWorld(world, ledger, prng);
    expect(world.player.pathIndex).toBe(1);
    expect(world.player.position).toEqual(world.player.path[0]);
  });

  it('verbraucht mit Speed-Stufe 6 drei Pfadschritte pro Tick', () => {
    const { world, ledger, prng } = walkRow(5);
    world.player.rpg.speedLevel = 6;
    tickWorld(world, ledger, prng);
    expect(world.player.pathIndex).toBe(3);
    expect(world.player.position).toEqual(world.player.path[2]);
  });
});
