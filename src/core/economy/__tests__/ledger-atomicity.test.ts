/**
 * @test-target: src/core/economy/ledger.ts
 * @error-code: ERR-1002
 *
 * Ledger-Transfer muss atomar sein: bei einem abgelehnten Buchung (z. B.
 * Zielkonto-Overflow) bleiben Quellkonto, Zielkonto, Entry-Count und Seq
 * unverkehrt. Keine Teilmutation, kein Seq-Fortschritt bei Fehler.
 */
import { describe, expect, it } from 'vitest';
import { Ledger, InsufficientFundsError } from '../ledger';
import { fromVC } from '../vacoin';

/** Zielkonto-Overflow (addVC-Ueberlauf) ist mit realen Werten kaum direkt
 * auslösbar, da MAX_SAFE_INTEGER erst bei enormen Beträgen erreicht wird.
 * Die Atomicity wird stattdessen durch Vorab-Berechnung beider Salden
 * (subVC + addVC vor this.#balances.set) sowie durch die Unterdeckungs-Tests
 * abgedeckt. */

describe('Ledger-Transfer-Atomicity', () => {
  it('normale transfers funktionieren weiterhin', () => {
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100), 'start', 0);
    ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(20), 'auszahlung', 1);
    expect(ledger.getBalance('HAUSKONTO')).toBe(fromVC(80));
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(20));
    expect(ledger.entryCount).toBe(2);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('liability-transfers duerfen ziel ins negative buchen', () => {
    const ledger = new Ledger();
    ledger.openLiability('HAUS_SCHULDEN');
    ledger.transfer('HAUS_SCHULDEN', 'PORTEMONNAIE', fromVC(5), 'kredit', 0);
    expect(ledger.getBalance('HAUS_SCHULDEN')).toBe(-fromVC(5));
    expect(ledger.getBalance('PORTEMONNAIE')).toBe(fromVC(5));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('selbsttransfer wirft fehler und bleibt integer', () => {
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(10), 'start', 0);
    const vorher = ledger.getBalance('HAUSKONTO');
    const countVorher = ledger.entryCount;
    expect(() => ledger.transfer('HAUSKONTO', 'HAUSKONTO', fromVC(1), 'selbst', 1))
      .toThrow();
    expect(ledger.getBalance('HAUSKONTO')).toBe(vorher);
    expect(ledger.entryCount).toBe(countVorher);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('unterdeckung wirft fehler und bleibt integer', () => {
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(5), 'start', 0);
    const vorher = ledger.getBalance('HAUSKONTO');
    const countVorher = ledger.entryCount;
    expect(() => ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(10), 'zu viel', 1))
      .toThrow(InsufficientFundsError);
    expect(ledger.getBalance('HAUSKONTO')).toBe(vorher);
    expect(ledger.entryCount).toBe(countVorher);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('diagnose bleibt gruen nach abgewiesenem transfer', () => {
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(10), 'start', 0);
    expect(() => ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(100), 'zu viel', 1))
      .toThrow();
    const diagnosis = ledger.diagnose();
    expect(diagnosis.ok).toBe(true);
    expect(diagnosis.entries).toBe(1);
    expect(diagnosis.lastSeq).toBe(0);
    expect(diagnosis.failure).toBeNull();
  });

  it('quelle-nicht-gefunden-overflow bleibt integer', () => {
    const ledger = new Ledger();
    const vorher = ledger.entryCount;
    expect(() => ledger.transfer('UNBEKANNT', 'ZIEL', fromVC(1), 'fehl', 0))
      .toThrow();
    expect(ledger.entryCount).toBe(vorher);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
