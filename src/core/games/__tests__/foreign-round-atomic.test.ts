/**
 * @test-target: src/core/sim/actions.ts
 * @error-code: ERR-1002
 *
 * Eine fremde Runde wird erst vollstaendig geprueft und gerechnet, dann
 * gebucht. Ein Fehler hinterlaesst weder Geld noch Zufall.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { foreignRound } from '../../sim/actions';
import { randomSeed } from '../../../test/random-seed';

const ledgerWith = (vc: number): Ledger => new Ledger({ PORTEMONNAIE: fromVC(vc) });
const seed = (): number => randomSeed() || 1;

describe('Fremde Spielrunde', () => {
  it('bucht bei ungueltigem Einsatz weder Geld noch Zufall', () => {
    const ledger = ledgerWith(5);
    const baseline = ledger.entries.length;
    const prng = new Prng(seed());
    const state = prng.getState();

    const negative = -1 as unknown as VaCoinMicro;
    const fractional = 1.5 as unknown as VaCoinMicro;

    expect(() => foreignRound(ledger, 'DICE', negative, prng, 0)).toThrow(/Einsatz/);
    expect(() => foreignRound(ledger, 'DICE', fractional, prng, 0)).toThrow(/Einsatz/);

    expect(ledger.entries.length).toBe(baseline);
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(5));
    expect(prng.getState()).toBe(state);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('prueft Optionen vor der ersten Buchung', () => {
    const ledger = ledgerWith(5);
    const baseline = ledger.entries.length;
    const prng = new Prng(seed());
    const state = prng.getState();

    expect(() => foreignRound(ledger, 'DICE', fromVC(1), prng, 3, 99_999)).toThrow(/houseEdgeBps/);

    expect(ledger.entries.length).toBe(baseline);
    expect(prng.getState()).toBe(state);
  });

  it('verweigert die Runde ohne Deckung ohne Teilbuchung', () => {
    const ledger = ledgerWith(0.1);
    const baseline = ledger.entries.length;
    const prng = new Prng(seed());
    const state = prng.getState();

    expect(() => foreignRound(ledger, 'SHELL', fromVC(1), prng, 4)).toThrow(/Bargeld/);

    expect(ledger.entries.length).toBe(baseline);
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(0.1));
    expect(prng.getState()).toBe(state);
  });

  it('bucht eine erfolgreiche Runde genau mit Einsatz und Auszahlung', () => {
    const ledger = ledgerWith(5);
    const baseline = ledger.entries.length;
    const prng = new Prng(seed());
    const state = prng.getState();
    const bet = fromVC(1);

    const result = foreignRound(ledger, 'SHELL', bet, prng, 7, 0);

    expect(result.stake).toBe(bet);
    expect(ledger.entries.length - baseline).toBe(result.payout > 0 ? 2 : 1);
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(5) - bet + result.payout);
    expect(prng.getState()).not.toBe(state);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
