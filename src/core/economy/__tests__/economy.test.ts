/**
 * @test-target: src/core/economy/ledger.ts
 * @error-code: ERR-1002
 */
import { describe, expect, it } from 'vitest';
import { InsufficientFundsError, Ledger, type AccountId } from '../ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { addVC, fromVC, mulVC, toVCString, type VaCoinMicro } from '../vacoin';

const ACCOUNTS: readonly AccountId[] = ['HAUSKONTO', 'WECHSELKASSE', 'SHOP', 'STAFF', 'UTILITIES', 'PORTEMONNAIE'];

describe('vacoin (Mikro-Geld)', () => {
  it('0.1 + 0.2 ergibt exakt 0.3000 VC', () => {
    const sum = addVC(fromVC(0.1), fromVC(0.2));
    expect(sum).toBe(3000);
    expect(toVCString(sum)).toBe('0.3000 VC');
    expect(toVCString(fromVC(0.1 + 0.2))).toBe('0.3000 VC');
  });

  it('formatiert immer 4 Nachkommastellen', () => {
    expect(toVCString(fromVC(12.34))).toBe('12.3400 VC');
    expect(toVCString(fromVC(1))).toBe('1.0000 VC');
    expect(toVCString(fromVC(0))).toBe('0.0000 VC');
    expect(toVCString(fromVC(-12.34))).toBe('-12.3400 VC');
    expect(toVCString(fromVC(0.0001))).toBe('0.0001 VC');
  });

  it('mulVC rechnet in Basispunkten mit Floor zugunsten der Bank', () => {
    expect(mulVC(fromVC(1), 5000)).toBe(5000);
    expect(mulVC(fromVC(100), 15000)).toBe(1_500_000);
    expect(mulVC(3 as VaCoinMicro, 3333)).toBe(0);
    expect(mulVC(-3 as VaCoinMicro, 3333)).toBe(-1);
  });
});

describe('ledger (doppelte Buchfuehrung)', () => {
  it('verweigert Buchungen ohne Deckung und laesst kein Konto ins Minus', () => {
    const ledger = new Ledger({ HAUSKONTO: fromVC(100), WECHSELKASSE: fromVC(50) });
    const before = ledger.snapshot();
    const logLength = ledger.entries.length;

    expect(() => ledger.transfer('HAUSKONTO', 'WECHSELKASSE', fromVC(100.0001), 'bet', 1)).toThrow(InsufficientFundsError);
    expect(() => ledger.transfer('HAUSKONTO', 'WECHSELKASSE', fromVC(100.0001), 'bet', 1)).toThrow(/Unterdeckung auf HAUSKONTO/);
    expect(ledger.snapshot()).toEqual(before);
    expect(ledger.entries.length).toBe(logLength);
    expect(ledger.getBalance('HAUSKONTO')).toBe(fromVC(100));
    expect(() => ledger.transfer('SHOP', 'HAUSKONTO', fromVC(0.0001), 'payout', 2)).toThrow(/Unterdeckung/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('loggt unveraenderliche Buchungssaetze und haelt die Summe bei 0', () => {
    const ledger = new Ledger({ HAUSKONTO: fromVC(250), WECHSELKASSE: fromVC(1000) });
    const entry = ledger.transfer('HAUSKONTO', 'WECHSELKASSE', fromVC(25), 'bet', 7);

    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as { reason: string }).reason = 'manipuliert';
    }).toThrow(TypeError);
    expect(entry.reason).toBe('bet');
    expect(toVCString(ledger.getBalance('HAUSKONTO'))).toBe('225.0000 VC');
    expect(toVCString(ledger.circulating)).toBe('1250.0000 VC');
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bleibt nach 400 zufaelligen Buchungen integer', () => {
    const random = new Prng(randomSeed());
    const ledger = new Ledger({
      HAUSKONTO: fromVC(1000),
      WECHSELKASSE: fromVC(5000),
      SHOP: fromVC(500),
    });
    let booked = 0;

    for (let i = 0; i < 400; i += 1) {
      const from = ACCOUNTS[Math.floor(random.nextFloat() * ACCOUNTS.length)]!;
      const to = ACCOUNTS[Math.floor(random.nextFloat() * ACCOUNTS.length)]!;
      if (from === to) continue;
      const balance = ledger.getBalance(from);
      if (balance <= 0) continue;
      const amount = (Math.floor(random.nextFloat() * balance) + 1) as VaCoinMicro;
      ledger.transfer(from, to, amount, `fuzz #${i}`, i);
      booked += 1;
    }

    expect(booked).toBeGreaterThan(150);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    const balances = ledger.snapshot();
    const net = ACCOUNTS.reduce((sum, account) => sum + balances[account]!, 0);
    expect(net).toBe(fromVC(6500));
    for (const account of ACCOUNTS) {
      expect(balances[account]!).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(balances[account]!)).toBe(true);
    }
    expect(toVCString(ledger.circulating)).toBe('6500.0000 VC');
  });
});
