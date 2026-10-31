/**
 * @test-target: src/core/games/contracts.ts
 * @error-code: ERR-1003
 *
 * Eine Runde ist eine Aktion plus Result; die Auszahlung folgt vollstaendig aus beidem.
 */
import { describe, expect, it } from 'vitest';
import { mulVC, fromVC, ZERO_VC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { playAction } from '../contracts';
import { randomSeed } from '../../../test/random-seed';
import type { GameId } from '../../sim/types';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const STAKE = fromVC(0.5);

describe('Spiel-Vertrag', () => {
  it('leitet die Auszahlung vollstaendig aus Einsatz und Result ab', () => {
    for (const game of GAMES) {
      const prng = new Prng(randomSeed());
      for (let index = 0; index < 12; index += 1) {
        const result = playAction({ game, stake: STAKE }, prng);
        expect(result.game).toBe(game);
        expect(result.stake).toBe(STAKE);
        expect(result.payout).toBe(mulVC(result.stake, result.multiplierBps));
        expect(result.payout).toBeGreaterThanOrEqual(0);
        expect(result.label.length).toBeGreaterThan(0);
        expect(result.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it('weist Aktionen ausserhalb des Vertrags ab, ohne Zufall zu verbrauchen', () => {
    const prng = new Prng(randomSeed());
    const state = prng.getState();
    expect(() => playAction({ game: 'SLOT', stake: -1 as VaCoinMicro }, prng)).toThrow();
    expect(() => playAction({ game: 'SLOT', stake: 1.5 as VaCoinMicro }, prng)).toThrow();
    expect(() => playAction({ game: 'NOPE' as GameId, stake: STAKE }, prng)).toThrow();
    expect(() => playAction({ game: 'SLOT', stake: STAKE, houseEdgeBps: 9_001 }, prng)).toThrow();
    expect(() => playAction({ game: 'SLOT', stake: STAKE, bonusBps: -5 }, prng)).toThrow();
    expect(() => playAction({ game: 'SLOT', stake: STAKE, houseEdgeBps: 2.5 }, prng)).toThrow();
    expect(prng.getState()).toBe(state);
  });

  it('rechnet Bonus und Hausvorteil nur auf Gewinne, nie ins Negative', () => {
    for (const game of GAMES) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const seed = randomSeed();
        const plain = playAction({ game, stake: STAKE }, new Prng(seed));
        const bonus = playAction({ game, stake: STAKE, bonusBps: 120 }, new Prng(seed));
        const edge = playAction({ game, stake: STAKE, houseEdgeBps: 250 }, new Prng(seed));
        expect(bonus.multiplierBps - plain.multiplierBps).toBeGreaterThanOrEqual(0);
        expect(bonus.multiplierBps - plain.multiplierBps).toBeLessThanOrEqual(120);
        expect(plain.multiplierBps - edge.multiplierBps).toBeGreaterThanOrEqual(0);
        expect(plain.multiplierBps - edge.multiplierBps).toBeLessThanOrEqual(250);
        for (const result of [plain, bonus, edge]) {
          expect(result.payout).toBe(mulVC(result.stake, result.multiplierBps));
        }
      }
    }
  });

  it('liefert nach dem gespeicherten PRNG-Zustand dasselbe Result', () => {
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 3; index += 1) prng.nextUint32();
    const saved = prng.getState();
    const first = playAction({ game: 'ROULETTE', stake: fromVC(2) }, prng);
    const resumed = playAction({ game: 'ROULETTE', stake: fromVC(2) }, new Prng(saved));
    expect(resumed).toEqual(first);
  });

  it('laesst den freien Testspin ohne Auszahlung', () => {
    const result = playAction({ game: 'SLOT', stake: ZERO_VC }, new Prng(randomSeed()));
    expect(result.stake).toBe(ZERO_VC);
    expect(result.payout).toBe(ZERO_VC);
    expect(result.multiplierBps).toBeGreaterThanOrEqual(0);
  });
});
