/**
 * @test-target: src/core/games/poker-hand.ts
 * @error-code: ERR-1003
 *
 * Tischpoker wird nicht ueber ein allgemeines RTP-Band bewertet: Die relevante
 * statistische Groesse ist die Verteilung der Handkategorien aus sieben Karten.
 * Die erwarteten Wahrscheinlichkeiten sind die bekannten 7-Karten-Frequenzen;
 * ein Chi-Quadrat-Test mit 8 Freiheitsgraden deckt eine falsche Bewertung auf.
 * Der Kartenschuh selbst wird in poker-table.test.ts und shoe.test.ts geprueft.
 */
import { describe, expect, it } from 'vitest';
import { randomSeed } from '../../../test/random-seed';
import { Prng } from '../../rng/prng';
import { createShoe } from '../../rng/shoe';
import { bestHand } from '../poker-hand';

/** Hohes Karte, Paar, Zwei Paar, Drilling, Strasse, Farbe, Full House, Vierling, Strasse in Farbe. */
const EXPECTED = [0.174119, 0.438225, 0.234955, 0.048299, 0.046194, 0.030255, 0.025961, 0.0016807, 0.0003108] as const;
const HANDS = 20_000;
/** Chi-Quadrat, 8 Freiheitsgrade, p = 0,001; ein kaputter Bewerter liegt weit darueber. */
const CRITICAL = 26.12;

describe('Poker-Handverteilung', () => {
  it('trifft die 7-Karten-Verteilung der Handkategorien', { timeout: 30_000 }, () => {
    const prng = new Prng(randomSeed());
    const counts = Array.from({ length: EXPECTED.length }, () => 0);
    for (let hand = 0; hand < HANDS; hand += 1) {
      // Frischer Schuh je Hand: Ein durchlaufender Schuh macht aufeinanderfolgende
      // Haende abhaengig und blaeht die Chi-Quadrat-Statistik ueber ihr kritisches Mass.
      const shoe = createShoe(prng);
      const cards = Array.from({ length: 7 }, () => shoe.draw());
      const category = bestHand(cards).cat;
      counts[category] = (counts[category] ?? 0) + 1;
    }
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(HANDS);
    const chiSquare = counts.reduce((sum, count, category) => {
      const expected = (EXPECTED[category] ?? 0) * HANDS;
      const delta = count - expected;
      return sum + (delta * delta) / expected;
    }, 0);
    expect(chiSquare, `Chi-Quadrat ${chiSquare.toFixed(2)} bei ${HANDS} Haenden`).toBeLessThan(CRITICAL);
  });
});
