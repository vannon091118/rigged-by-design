/**
 * @test-target: src/core/games/sandbox.ts
 * @error-code: ERR-1003
 *
 * Alle sieben Spiele laufen im Testmodus derselben Sandbox: eigener Seed,
 * lesende Welt, kein Ledger, kein Fortschritt, kein Welt-PRNG. Zwei Vorschauen
 * mit gleichem Seed liefern dasselbe Ergebnis.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { testSpin } from '../../sim/actions';
import { createWorld } from '../../sim/templates';
import type { Furniture, GameId } from '../../sim/types';
import { createSlotMemory } from '../slot-transparency';
import { liveSandbox, playSandboxGame, testSandbox, type GameSandbox } from '../sandbox';
import { randomSeed } from '../../../test/random-seed';

const GAMES: readonly GameId[] = ['SLOT', 'PLINKO', 'BLACKJACK', 'POKER', 'ROULETTE', 'SHELL', 'DICE'];

/** Ein Geraet je Spiel, damit jeder Vorschaupfad einzeln laeuft. */
function machineFor(world: ReturnType<typeof createWorld>, game: GameId, id: number): Furniture {
  const base = world.furniture.find((item) => item.gameId === 'SLOT')!;
  const copy: Furniture = { ...base, id, gameId: game, mods: [] };
  if (game === 'SLOT') copy.slotMemory = createSlotMemory(copy.reels);
  world.furniture.push(copy);
  return copy;
}

describe('Kostenloser Testspin', () => {
  for (const [index, game] of GAMES.entries()) {
    it(`isoliert ${game}: gleicher Seed, gleiches Ergebnis, keine Weltänderung`, () => {
      const world = createWorld('SMALL');
      const item = machineFor(world, game, 9_000 + index);
    const before = structuredClone(world);
    const seed = randomSeed() || 1;
    const sandbox: GameSandbox = testSandbox(world, seed);    expect(sandbox.mode).toBe('TEST');
    const first = playSandboxGame(sandbox, item);
    const second = testSpin(item, world, seed);

    expect(first.game).toBe(game);
    expect(second).toEqual(first);
    expect(world).toEqual(before);
    });
  }

  it('verweigert Einsatz und ungueltigen Seed im Testmodus', () => {
    const world = createWorld('SMALL');
    const slot = machineFor(world, 'SLOT', 9_101);
    const seed = randomSeed() || 1;

    expect(() => testSandbox(world, 0)).toThrow(/Seed/);
    expect(() => playSandboxGame(testSandbox(world, seed), slot, {}, fromVC(1))).toThrow(/Einsatz/);
  });

  it('bucht auch im Live-Modus nicht selbst', () => {
    const world = createWorld('SMALL');
    const dice = machineFor(world, 'DICE', 9_102);
    const before = structuredClone(world);
    const prng = new Prng(randomSeed() || 1);
    const stake = fromVC(1);

    const result = playSandboxGame(liveSandbox(world, prng), dice, {}, stake);

    expect(result.game).toBe('DICE');
    expect(result.stake).toBe(stake);
    expect(world).toEqual(before);
  });
});
