/**
 * @test-target: src/core/games/roulette-table.ts
 * @error-code: ERR-1003
 *
 * Das Tableau muss jede Zahl genau einmal abdecken, jede Quote exakt auszahlen
 * und mehrere Jetons in einer Drehung gemeinsam abrechnen.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import {
  ROULETTE_WHEEL, colourOf, spotCovers, spotInfo, spinRouletteTable, totalStake,
} from '../roulette-table';
import { fromVC, mulVC } from '../../economy/vacoin';

const NUMBERS = Array.from({ length: 37 }, (_, index) => index);

describe('Roulette-Tableau', () => {
  it('ordnet den Kessel in der europaeischen Reihenfolge an', () => {
    expect(ROULETTE_WHEEL).toHaveLength(37);
    expect(new Set(ROULETTE_WHEEL).size).toBe(37);
    expect(ROULETTE_WHEEL[0]).toBe(0);
    expect(ROULETTE_WHEEL[18]).toBe(10);
  });

  it('deckt mit jedem einfachen Feld genau die Haelfte der Zahlen ab', () => {
    for (const spot of ['RED', 'BLACK', 'EVEN', 'ODD', 'LOW', 'HIGH']) {
      expect(NUMBERS.filter((number) => spotCovers(spot, number))).toHaveLength(18);
    }
    expect(spotCovers('RED', 0)).toBe(false);
    expect(spotCovers('BLACK', 0)).toBe(false);
  });

  it('deckt Dutzende, Kolonnen und Einzelzahlen korrekt ab', () => {
    expect(NUMBERS.filter((number) => spotCovers('D1', number))).toHaveLength(12);
    expect(NUMBERS.filter((number) => spotCovers('C1', number))).toHaveLength(12);
    expect(spotCovers('C1', 1)).toBe(true);
    expect(spotCovers('C1', 2)).toBe(false);
    expect(spotCovers('N17', 17)).toBe(true);
    expect(spotCovers('N17', 18)).toBe(false);
    expect(spotInfo('N0')?.label).toBe('0');
    expect(spotInfo('X9')).toBeNull();
  });

  it('farbt die Null gruen und sonst nach Tabelle', () => {
    expect(colourOf(0)).toBe('gruen');
    expect(colourOf(32)).toBe('rot');
    expect(colourOf(15)).toBe('schwarz');
  });

  it('rechnet mehrere Jetons einer Drehung gemeinsam ab', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 120; round += 1) {
      const chips = [
        { spot: 'N7', stake: fromVC(1) },
        { spot: 'RED', stake: fromVC(2) },
        { spot: 'D1', stake: fromVC(1) },
      ];
      const stake = totalStake(chips);
      expect(stake).toBe(fromVC(4));
      const spin = spinRouletteTable(prng, chips);
      expect(spin.number).toBeGreaterThanOrEqual(0);
      expect(spin.number).toBeLessThanOrEqual(36);
      const expected = chips
        .filter((chip) => spotCovers(chip.spot, spin.number))
        .reduce((sum, chip) => sum + mulVC(chip.stake, spotInfo(chip.spot)!.bps), 0);
      expect(spin.hits.reduce((sum, hit) => sum + hit.payout, 0)).toBe(expected > 0 ? mulVC(stake, spin.multiplierBps) : 0);
      if (spin.multiplierBps === 0) expect(spin.hits).toHaveLength(0);
    }
  });

  it('zahlt eine Einzelzahl mit der Quote des Feldes aus', () => {
    const prng = new Prng(randomSeed());
    let straight: ReturnType<typeof spinRouletteTable> | null = null;
    for (let round = 0; round < 400 && !straight; round += 1) {
      const spin = spinRouletteTable(prng, [{ spot: 'N7', stake: fromVC(1) }]);
      if (spin.number === 7) straight = spin;
    }
    expect(straight).not.toBeNull();
    expect(straight!.multiplierBps).toBe(360_000);
  });

  it('verweigert eine Drehung ohne Jeton', () => {
    expect(() => spinRouletteTable(new Prng(randomSeed()), [])).toThrow(/ohne Jeton/);
  });
});
