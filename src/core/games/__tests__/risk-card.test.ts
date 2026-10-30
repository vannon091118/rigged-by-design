/**
 * @test-target: src/core/games/risk-card.ts
 * @error-code: ERR-1002
 *
 * Die Risiko-Karte ist doppelte Buchfuehrung: verdoppeln zahlt das fremde Haus,
 * verlieren bucht den Gewinn zurueck. Nie ein Geldtopf aus dem Nichts.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { drawRiskCard, gambleRivalWin } from '../risk-card';
import { randomSeed } from '../../../test/random-seed';

const PORTEMONNAIE = 'PORTEMONNAIE';
const EXTERNAL_WORLD = 'EXTERNAL_WORLD';
const STAKE = fromVC(4);

function seededLedger(): Ledger {
  return new Ledger({ [PORTEMONNAIE]: fromVC(10), [EXTERNAL_WORLD]: fromVC(1_000) });
}

describe('Risiko-Karte', () => {
  it('zieht eine von zwei Farben und bleibt bei gleichem Seed gleich', () => {
    const seed = randomSeed();
    const first = drawRiskCard(new Prng(seed));
    const again = drawRiskCard(new Prng(seed));
    expect(again).toBe(first);
    expect(['ROT', 'SCHWARZ']).toContain(first);
  });

  it('verdoppelt bei richtiger Farbe aus der Tasche des fremden Hauses', () => {
    const prng = new Prng(randomSeed());
    const ledger = seededLedger();
    const card = drawRiskCard(new Prng(prng.seed));
    const before = ledger.getBalance(PORTEMONNAIE);
    const outcome = gambleRivalWin(ledger, STAKE, card, prng, 7);
    expect(outcome.won).toBe(true);
    expect(outcome.payout).toBe(STAKE * 2);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before + STAKE);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bucht den Gewinn bei falscher Farbe zurueck ins fremde Haus', () => {
    const prng = new Prng(randomSeed());
    const ledger = seededLedger();
    const card = drawRiskCard(new Prng(prng.seed));
    const wrong = card === 'ROT' ? 'SCHWARZ' : 'ROT';
    const before = ledger.getBalance(PORTEMONNAIE);
    const outcome = gambleRivalWin(ledger, STAKE, wrong, prng, 8);
    expect(outcome.won).toBe(false);
    expect(outcome.card).toBe(card);
    expect(outcome.payout).toBe(0);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - STAKE);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('weist Einsaetze ab, die nicht im Portemonnaie liegen', () => {
    const prng = new Prng(randomSeed());
    const ledger = seededLedger();
    expect(() => gambleRivalWin(ledger, fromVC(0), 'ROT', prng, 9)).toThrow();
    expect(() => gambleRivalWin(ledger, fromVC(99), 'ROT', prng, 9)).toThrow();
  });
});
