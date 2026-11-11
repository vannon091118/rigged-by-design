/**
 * @test-target: src/core/games/engines/slot-models.ts
 * @error-code: ERR-1003
 *
 * Die Linien-Erwartung zaehlt genau den Lauf, den die Engine zahlt: kein
 * Fremdsymbol erbt einen reinen Buch-Praefix, und BOOK zahlt nur die reine
 * Buch-Linie.
 */
import { describe, expect, it } from 'vitest';
import { lineStats, modelExpectation, payBps } from '../engines/slot-models';
import { SLOT_SYMBOLS, WEIGHTS, weightTotal } from '../engines/slot-paytable';
import { DEFAULT_SLOT_PROFILE, slotChances } from '../slot-profile';

function bruteLine(wild: boolean): { expectation: number; hit: number } {
  const total = weightTotal(WEIGHTS);
  let expectation = 0;
  let hit = 0;
  for (const first of SLOT_SYMBOLS) {
    for (const second of SLOT_SYMBOLS) {
      for (const third of SLOT_SYMBOLS) {
        const line = [first, second, third] as const;
        const probability = line.reduce((value, symbol) => value * (Math.max(0, WEIGHTS[symbol]) / total), 1);
        const lead = line.find((symbol) => symbol !== 'BOOK') ?? 'BOOK';
        let run = 0;
        for (const symbol of line) {
          if (symbol === lead || (wild && symbol === 'BOOK')) run += 1;
          else break;
        }
        if (run < 3) continue;
        expectation += probability * payBps(lead, run, 1, 'MID');
        hit += probability;
      }
    }
  }
  return { expectation, hit };
}

describe('Exakte Linien-Erwartung', () => {
  it('stimmt bei drei Walzen mit der vollstaendigen Enumeration ueberein', () => {
    const brute = bruteLine(true);
    const exact = lineStats(3, WEIGHTS, true, 'MID');
    expect(exact.expectation).toBeCloseTo(brute.expectation, 12);
    expect(exact.hitBps).toBeCloseTo(brute.hit * 10_000, 10);
    expect(exact.expectation).toBeCloseTo(143.590740, 5);
  });

  it('bleibt bei vier und fuenf Walzen auf der korrigierten Linien-Wahrheit', () => {
    expect(modelExpectation('LINES', 4, WEIGHTS, true, 'MID')).toBeCloseTo(220.210949, 5);
    expect(modelExpectation('LINES', 5, WEIGHTS, true, 'MID')).toBeCloseTo(306.402165, 5);
  });

  it('zeigt die exakte Trefferchance je Linie', () => {
    const brute = bruteLine(true);
    const chances = slotChances(3, DEFAULT_SLOT_PROFILE);
    expect(chances.lineHitBps).toBe(Math.round(brute.hit * 10_000));
    expect(chances.linesPerSpin).toBe(Number(((3 * chances.lineHitBps) / 10_000).toFixed(2)));
  });
});
