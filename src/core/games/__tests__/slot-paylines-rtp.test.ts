/**
 * @test-target: src/core/games/engines/slot.ts | @error-code: ERR-4027
 *
 * Langsamer RTP-Nachweis fuer drei und fuenf Walzen; deterministische
 * Gewinnlinien-Invarianten liegen in slot-paylines.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { playSlot } from '../engines/slot';
import { payScaleFor } from '../engines/slot-odds';
import { randomSeed } from '../../../test/random-seed';

describe('Slot-RTP ueber Walzenvarianten', () => {
  it('haelt drei und fuenf Walzen im gleichen Hausvorteilsband', { timeout: 120_000 }, () => {
    const measure = (reels: number): number => {
      const prng = new Prng(randomSeed());
      const rounds = 120_000;
      let sum = 0;
      for (let index = 0; index < rounds; index += 1) sum += playSlot(prng, { reels }).multiplierBps;
      return sum / rounds / 10_000;
    };
    const three = measure(3);
    const five = measure(5);
    expect(five).toBeGreaterThan(0.85);
    expect(five).toBeLessThan(1);
    expect(Math.abs(three - five), `drei ${three.toFixed(3)} gegen fuenf ${five.toFixed(3)}`).toBeLessThan(0.05);
    expect(payScaleFor(3)).toBeGreaterThan(payScaleFor(5));
  });
});
