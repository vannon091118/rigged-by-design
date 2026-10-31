/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Durchsatz-Messung der Spielrunden. Bewusst nicht Teil von verify:all:
 * Sie misst Geschwindigkeit und darf auf langsamer Hardware nicht rot werden.
 * Jeder Lauf zieht einen frischen Seed; die Iterationszahl ist fest.
 */
import { test } from 'vitest';
import { measure } from '../../../test/measure';
import { randomSeed } from '../../../test/random-seed';
import { Prng } from '../../rng/prng';
import type { GameId } from '../../sim/types';
import { playRound } from '../round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'VIDEO_POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const ROUNDS = 20_000;
/** Plinko laeuft durch Physik und ist rund tausendmal teurer; 500 Drops reichen. */
const PLINKO_ROUNDS = 500;

test('Spieldurchsatz je Runde', { timeout: 60_000 }, () => {
  for (const game of GAMES) {
    const rounds = game === 'PLINKO' ? PLINKO_ROUNDS : ROUNDS;
    const seed = randomSeed();
    const result = measure(game, () => {
      const prng = new Prng(seed);
      for (let index = 0; index < rounds; index += 1) playRound(game, prng);
    }, { iterations: 5, note: `${rounds} Runden je Operation` });
    console.log(`${game}: ${(result.meanMs / rounds).toFixed(4)} ms/Runde`);
  }
});
