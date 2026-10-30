/**
 * @test-target: src/core/economy/ledger.ts
 * @error-code: ERR-1002
 *
 * Diagnose muss Zustand, Buchungszahl und Bruchursache nachvollziehbar liefern.
 */
import { describe, expect, it } from 'vitest';
import { applyEntry, verifyBalanceSheet } from '../ledger-integrity';
import { Ledger } from '../ledger';
import { fromVC, type VaCoinMicro } from '../vacoin';

describe('Ledger-Diagnose', () => {
  it('meldet gesunden Zustand, Buchungszahl und Umlauf', () => {
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(10), 'start', 0);
    ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(3), 'abheben', 4);
    const report = ledger.diagnose();
    expect(report.ok).toBe(true);
    expect(report.entries).toBe(2);
    expect(report.lastSeq).toBe(1);
    expect(report.lastTick).toBe(4);
    expect(report.circulating).toBe(fromVC(10));
    expect(report.failure).toBeNull();
    expect(ledger.entriesSince(1)).toHaveLength(1);
    expect(ledger.entryCount).toBe(2);
  });

  it('führt Verbindlichkeitskonten getrennt und erlaubt ihnen Unterdeckung', () => {
    const ledger = new Ledger();
    ledger.openLiability('HAUS_SCHULDEN');
    expect(ledger.liabilityAccounts).toEqual(['HAUS_SCHULDEN']);
    ledger.transfer('HAUS_SCHULDEN', 'PORTEMONNAIE', fromVC(4), 'schuld', 1);
    expect(ledger.getBalance('HAUS_SCHULDEN')).toBe(-fromVC(4));
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('erkennt eine nicht gedeckte Buchung und eine falsche Bilanz im Replay', () => {
    const entry = { seq: 0, tick: 0, from: 'A', to: 'B', amount: fromVC(2), reason: 'test' };
    const replay = new Map<string, VaCoinMicro>([['A', fromVC(1)]]);
    expect(applyEntry(replay, entry, new Set())).toBe(false);
    expect(replay.get('A')).toBe(fromVC(1));

    const balances = new Map<string, VaCoinMicro>([
      ['EXTERNAL_WORLD', -fromVC(1) as VaCoinMicro], ['A', fromVC(1)],
    ]);
    expect(verifyBalanceSheet(new Map(balances), balances, new Set())).toBe(true);
    expect(verifyBalanceSheet(
      new Map([['EXTERNAL_WORLD', -fromVC(1) as VaCoinMicro], ['A', fromVC(2)]]), balances, new Set(),
    )).toBe(false);
  });
});
