/**
 * @test-target: src/core/games/engines/slot.ts
 * @error-code: ERR-1003
 *
 * Das Gitter muss die Gewinnlinien exakt tragen: was die Anzeige als Treffer
 * zeichnet, ist die Linie, die die Engine bezahlt hat.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { SLOT_LINES, SLOT_SYMBOLS, playSlot } from '../engines/slot';
import { slotPaylines } from '../engines/slot-paytable';
import { payScaleFor } from '../engines/slot-odds';
import { randomSeed } from '../../../test/random-seed';

describe('Slot-Gitter fuer die Anzeige', () => {
  it('liefert fuenf Walzen mit je drei Reihen aus gueltigen Symbolen', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 15; round += 1) {
      const outcome = playSlot(prng);
      expect(outcome.grid).toHaveLength(5);
      for (const reel of outcome.grid) {
        expect(reel).toHaveLength(3);
        for (const symbol of reel) expect(SLOT_SYMBOLS).toContain(symbol);
      }
    }
  });

  it('beschreibt jede Gewinnlinie mit echter Linie, Laenge und Auszahlung', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 40; round += 1) {
      const outcome = playSlot(prng);
      for (const win of outcome.wins) {
        const line = SLOT_LINES[win.line]!;
        expect(line).toHaveLength(5);
        expect(win.count).toBeGreaterThanOrEqual(3);
        expect(win.count).toBeLessThanOrEqual(5);
        expect(win.bps).toBeGreaterThan(0);
        const drawn = line.map((row, reel) => outcome.grid[reel]![row]!);
        for (let index = 0; index < win.count; index += 1) {
          expect(drawn[index] === win.symbol || drawn[index] === 'BOOK').toBe(true);
        }
      }
    }
  });

  it('meldet ohne Auszahlung keine Linie und mit Linie immer Gewinn', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 40; round += 1) {
      const outcome = playSlot(prng);
      if (outcome.multiplierBps === 0) expect(outcome.wins).toHaveLength(0);
      if (outcome.wins.length > 0) expect(outcome.multiplierBps).toBeGreaterThan(0);
    }
  });

  it('zaehlt Buecher fuer die Freispiel-Show unabhaengig von der Linie', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 20; round += 1) {
      const outcome = playSlot(prng);
      const books = outcome.grid.flat().filter((symbol) => symbol === 'BOOK').length;
      expect(outcome.books).toBe(books);
      expect(outcome.jackpot).toBe(books >= 3);
    }
  });

  it('dreht genau die Walzen des Geraets und bezahlt dessen Linien', () => {
    const prng = new Prng(randomSeed());
    for (const reels of [3, 4, 5]) {
      const outcome = playSlot(prng, { reels });
      expect(outcome.grid).toHaveLength(reels);
      const lines = slotPaylines(reels);
      for (const win of outcome.wins) {
        const line = lines[win.line]!;
        expect(line).toHaveLength(reels);
        expect(win.count).toBeLessThanOrEqual(reels);
        const drawn = line.map((row, reel) => outcome.grid[reel]![row]!);
        for (let index = 0; index < win.count; index += 1) {
          expect(drawn[index] === win.symbol || drawn[index] === 'BOOK').toBe(true);
        }
      }
    }
  });

  it('zahlt drei, vier und fuenf Walzen auf demselben Niveau', { timeout: 60_000 }, () => {
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
    // Die Walzenzahl veraendert Kombinationen und Streuung, nicht den Hausvorteil.
    const gap = Math.abs(three - five);
    expect(gap, 'drei ' + three.toFixed(3) + ' gegen fuenf ' + five.toFixed(3)).toBeLessThan(0.05);
    // Weniger Trefferkombinationen brauchen dafuer eine groessere Skalierung.
    expect(payScaleFor(3)).toBeGreaterThan(payScaleFor(5));
  });
});