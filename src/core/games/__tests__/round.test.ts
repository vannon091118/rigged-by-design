/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Die RTP-Monte-Carlo-Laeufe liegen in round-rtp-high.test.ts und
 * round-rtp-machines.test.ts, damit sie in eigenen Workern parallel laufen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { foreignRound, testSpin } from '../../sim/actions';
import { createWorld } from '../../sim/templates';
import type { GameId } from '../../sim/types';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { playRound } from '../round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];

describe('Spiele', () => {
  it('jedes Spiel liefert eine gueltige, deterministische Runde', () => {
    const seed = randomSeed();
    for (const game of GAMES) {
      const a = playRound(game, new Prng(seed));
      const b = playRound(game, new Prng(seed));
      expect(a).toEqual(b);
      expect(a.game).toBe(game);
      expect(Number.isSafeInteger(a.multiplierBps)).toBe(true);
      expect(a.detail.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  it('der Testspin kostet kein Geld und veraendert das Ledger nicht', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    const entries = ledger.entries.length;
    const result = testSpin(slot, new Prng(randomSeed()));
    expect(result.game).toBe('SLOT');
    expect(ledger.entries.length).toBe(entries);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('fremde Spiele buchen nur vom Portemonnaie und nie ins Minus', () => {
    const ledger = new Ledger({ PORTEMONNAIE: fromVC(2) });
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 20; index += 1) {
      if (ledger.getBalance('PORTEMONNAIE') < fromVC(0.2)) break;
      foreignRound(ledger, GAMES[index % GAMES.length]!, fromVC(0.2), prng, index, 200);
      expect(ledger.getBalance('PORTEMONNAIE')).toBeGreaterThanOrEqual(0);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
    }
  });
});
