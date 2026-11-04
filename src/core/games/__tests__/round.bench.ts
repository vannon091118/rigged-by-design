/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Durchsatz-Messung der Spielrunden. Bewusst nicht Teil von verify:all:
 * Sie misst Geschwindigkeit und darf auf langsamer Hardware nicht rot werden.
 * Jeder Lauf zieht einen frischen Seed. Statt einer festen Rundenzeit hat jedes
 * Spiel ein Zeitbudget: die Kennzahl ms/Runde entsteht auch auf schwacher
 * Hardware, statt dass die Messung in einen Timeout laeuft.
 */
import { test } from 'vitest';
import { randomSeed } from '../../../test/random-seed';
import { Prng } from '../../rng/prng';
import type { GameId } from '../../sim/types';
import { playRound } from '../round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'VIDEO_POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const TARGET_ROUNDS = 20_000;
/** Plinko laeuft durch Physik und ist rund tausendmal teurer; 500 Drops reichen. */
const PLINKO_ROUNDS = 500;
/** Obergrenze je Spiel; schnelle Kerne erreichen die Zielrunden, langsame nicht. */
const BUDGET_MS = 3_000;
const CHUNK = 250;

test('Spieldurchsatz je Runde', { timeout: 120_000 }, () => {
  for (const game of GAMES) {
    const target = game === 'PLINKO' ? PLINKO_ROUNDS : TARGET_ROUNDS;
    const prng = new Prng(randomSeed());
    const start = process.hrtime.bigint();
    let done = 0;
    while (done < target) {
      const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
      if (elapsed >= BUDGET_MS) break;
      const chunk = Math.min(CHUNK, target - done);
      for (let index = 0; index < chunk; index += 1) playRound(game, prng);
      done += chunk;
    }
    const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(`${game}: ${(elapsed / Math.max(1, done)).toFixed(4)} ms/Runde (${done} Runden, ${elapsed.toFixed(0)} ms)`);
  }
});
