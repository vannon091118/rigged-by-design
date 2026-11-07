/**
 * @test-target: src/core/sim/tx-reasons.ts
 * @error-code: ERR-1002
 *
 * Jeder Grund, den ein Aufrufer bucht, muss in der Kennzahl landen, die er
 * bedeutet. Der Test koppelt Buchung und Klassifizierung an dieselbe Quelle,
 * damit ein abweichender String nicht still in den Investitionstopf rutscht.
 */
import { describe, expect, it } from 'vitest';
import { MINTING_ACCOUNT } from '../../economy/ledger-integrity';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { economyOf } from '../economics';
import { EXTERNAL, HAUSKONTO, SHOP } from '../money';
import {
  GUEST_REASON,
  TX_PREFIX,
  TX_REASON,
  guestReason,
  guestReasonKind,
  shopBucket,
} from '../tx-reasons';

describe('tx-reasons (ein Grund, eine Klassifizierung)', () => {
  it('hat für den Aussenwelt-Topf genau eine Wahrheit', () => {
    expect(EXTERNAL).toBe(MINTING_ACCOUNT);
  });

  it('ordnet Betriebskosten dem Betrieb zu, nicht dem Ausbau', () => {
    expect(shopBucket(TX_REASON.CLEANING)).toBe('operating');
    expect(shopBucket(TX_REASON.DEEP_CLEANING)).toBe('operating');
    expect(shopBucket(TX_REASON.REPAIR)).toBe('operating');
    expect(shopBucket(TX_REASON.MOD_OPERATING)).toBe('operating');
  });

  it('ordnet Wareneinkauf den Waren zu, nicht dem Ausbau', () => {
    expect(shopBucket(TX_REASON.DRINK_CRATE)).toBe('goods');
    expect(shopBucket(TX_REASON.SPARE_PARTS)).toBe('goods');
  });

  it('ordnet Ausbau und Kauf dem Kapital zu', () => {
    expect(shopBucket(TX_REASON.REEL_UPGRADE)).toBe('investment');
    expect(shopBucket(TX_REASON.BAR_UPGRADE)).toBe('investment');
    expect(shopBucket(TX_REASON.WC_UPGRADE)).toBe('investment');
    expect(shopBucket(`${TX_PREFIX.MOD_PURCHASE}TURBO`)).toBe('investment');
    expect(shopBucket(`${TX_PREFIX.BUILD_PURCHASE}Slot`)).toBe('investment');
    expect(shopBucket(`${TX_PREFIX.EXPANSION}bar`)).toBe('investment');
  });

  it('erkennt Gastumsatz am Suffix, egal welche Gast-ID gebucht hat', () => {
    expect(guestReason('STAKE', 7)).toBe(`gast 7 ${GUEST_REASON.STAKE}`);
    expect(guestReasonKind(guestReason('STAKE', 7))).toBe('STAKE');
    expect(guestReasonKind(guestReason('DRINK', 12))).toBe('DRINK');
    expect(guestReasonKind(TX_REASON.DRINK_SALE)).toBe('DRINK');
    expect(guestReasonKind('gast 3 chips')).toBeNull();
  });

  it('vergibt jeden Grund nur einmal', () => {
    const values = Object.values(TX_REASON);
    expect(new Set(values).size).toBe(values.length);
  });

  it('bucht Betrieb, Ware, Ausbau und Gastumsatz in getrennte Toepfe', () => {
    const ledger = new Ledger({ HAUSKONTO: fromVC(1000), WECHSELKASSE: fromVC(500) });
    ledger.transfer('WECHSELKASSE', 'VISITOR_1', fromVC(100), 'gast 1 chips', 0);
    ledger.transfer(HAUSKONTO, SHOP, fromVC(10), TX_REASON.CLEANING, 1);
    ledger.transfer(HAUSKONTO, SHOP, fromVC(20), TX_REASON.DRINK_CRATE, 2);
    ledger.transfer(HAUSKONTO, SHOP, fromVC(30), `${TX_PREFIX.MOD_PURCHASE}TURBO`, 3);
    ledger.transfer('VISITOR_1', HAUSKONTO, fromVC(40), guestReason('STAKE', 1), 4);
    ledger.transfer('VISITOR_1', HAUSKONTO, fromVC(5), guestReason('DRINK', 1), 5);
    ledger.transfer('VISITOR_1', HAUSKONTO, fromVC(3), TX_REASON.DRINK_SALE, 6);
    const summary = economyOf(ledger);

    expect(summary.operatingRepairs).toBe(10);
    expect(summary.goods).toBe(20);
    expect(summary.investment).toBe(30);
    expect(summary.stakeVolume).toBe(40);
    expect(summary.serviceRevenue).toBe(8);
    expect(summary.operatingProfit).toBe(18);
  });
});
