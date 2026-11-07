/**
 * @test-target: src/core/economy/ledger.ts
 * @error-code: ERR-1002
 *
 * Die volle Pruefung bleibt vollstaendig, die inkrementelle meldet denselben Zustand.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../vacoin';
import { Ledger, InsufficientFundsError } from '../ledger';

function busy(): Ledger {
  const ledger = new Ledger();
  for (let index = 1; index <= 300; index += 1) {
    ledger.transfer('EXTERNAL_WORLD', `VISITOR_${index}`, fromVC(2), 'fiat', 0);
    ledger.transfer(`VISITOR_${index}`, 'HAUSKONTO', fromVC(0.5), 'einsatz', index);
  }
  return ledger;
}

describe('Ledger-Pruefung', () => {
  it('bleibt nach langer Historie vollstaendig korrekt', () => {
    const ledger = busy();
    expect(ledger.entries).toHaveLength(600);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.verifyIncremental()).toBe(true);
    expect(ledger.getBalance('HAUSKONTO')).toBe(fromVC(150));
  });

  it('prueft ab dem Checkpoint weiter und erkennt neue Buchungen', () => {
    const ledger = busy();
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(10), 'entnahme', 999);
    expect(ledger.verifyIncremental()).toBe(true);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(10));
  });

  it('meldet Unterdeckung weiterhin als Fehler und bleibt danach integer', () => {
    const ledger = busy();
    expect(() => ledger.transfer('PORTEMONNAIE', 'HAUSKONTO', fromVC(1), 'zu viel', 5))
      .toThrow(InsufficientFundsError);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.verifyIncremental()).toBe(true);
  });

  it('zaehlt Verbindlichkeiten weiter mit und kippt nicht ins Negative', () => {
    const ledger = new Ledger();
    ledger.openLiability('HAUS_SCHULDEN');
    ledger.transfer('HAUS_SCHULDEN', 'PENDING_1', fromVC(5), 'gewinn auf kredit', 1);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.verifyIncremental()).toBe(true);
    expect(ledger.getBalance('HAUS_SCHULDEN')).toBe(fromVC(-5));
  });

  it('haelt die Summe aller Konten auf null', () => {
    const ledger = busy();
    const total = ledger.accounts.reduce((sum, account) => sum + ledger.getBalance(account), 0);
    expect(total).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
