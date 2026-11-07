/**
 * @test-target: src/core/games/dice-bets.ts
 * @error-code: ERR-1003
 *
 * Jedes Wettfeld am Wuerfeltisch muss exakt sagen, wann es gewinnt, und seine
 * Auszahlung muss im ehrlichen RTP-Band des Hauses bleiben.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { DICE_BETS, diceBetWins, rollDiceBet } from '../dice-bets';
import { randomSeed } from '../../../test/random-seed';

const COMBOS: readonly (readonly [number, number])[] = Array.from({ length: 36 }, (_, index) => {
  const a = Math.floor(index / 6) + 1;
  const b = (index % 6) + 1;
  return [a, b] as const;
});

describe('Wuerfel-Wettfelder', () => {
  it('bietet fuenf Felder mit Beschriftung und Auszahlung', () => {
    expect(DICE_BETS).toHaveLength(5);
    for (const bet of DICE_BETS) {
      expect(bet.label.length).toBeGreaterThan(2);
      expect(bet.hint.length).toBeGreaterThan(5);
      expect(bet.payoutBps).toBeGreaterThan(10_000);
    }
  });

  it('trifft nur die eigenen Summen und Pasche', () => {
    for (const [a, b] of COMBOS) {
      const sum = a + b;
      expect(diceBetWins('UNDER', a, b)).toBe(sum < 7);
      expect(diceBetWins('SEVEN', a, b)).toBe(sum === 7);
      expect(diceBetWins('OVER', a, b)).toBe(sum > 7);
      expect(diceBetWins('DOUBLES', a, b)).toBe(a === b);
      expect(diceBetWins('HIGH', a, b)).toBe(sum >= 10);
    }
  });

  it('haelt jede Wette im RTP-Band von 90 bis 96 Prozent', () => {
    for (const bet of DICE_BETS) {
      const hits = COMBOS.filter(([a, b]) => diceBetWins(bet.id, a, b)).length;
      const rtp = (hits / COMBOS.length) * (bet.payoutBps / 10_000);
      expect(rtp).toBeGreaterThanOrEqual(0.9);
      expect(rtp).toBeLessThanOrEqual(0.96);
    }
  });

  it('wuerfelt zwei echte Augen und rechnet daraus den Treffer', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 200; round += 1) {
      const bet = DICE_BETS[round % DICE_BETS.length]!;
      const outcome = rollDiceBet(bet.id, prng);
      expect(outcome.dice[0]).toBeGreaterThanOrEqual(1);
      expect(outcome.dice[0]).toBeLessThanOrEqual(6);
      expect(outcome.dice[1]).toBeGreaterThanOrEqual(1);
      expect(outcome.dice[1]).toBeLessThanOrEqual(6);
      expect(outcome.sum).toBe(outcome.dice[0] + outcome.dice[1]);
      expect(outcome.won).toBe(diceBetWins(bet.id, outcome.dice[0], outcome.dice[1]));
      expect(outcome.multiplierBps).toBe(outcome.won ? bet.payoutBps : 0);
    }
  });
});
