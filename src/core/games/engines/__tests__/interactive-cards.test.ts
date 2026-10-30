/**
 * @test-target: src/core/games/engines/interactive-cards.ts
 * @error-code: ERR-1003
 *
 * Blackjack und Video Poker laufen jetzt Zug fuer Zug. Der Kern muss jeden Zug
 * mit derselben Sorgfalt rechnen wie die Auto-Engine: Punkte, Dealer-Regel,
 * Auszahlung und Kartenverbrauch im Schuh.
 */
import { describe, expect, it } from 'vitest';
import { createCardShoe, doubleBlackjack, drawVideoPoker, evaluateVideoPoker, handTotal, hitBlackjack, isSoftHand, standBlackjack, startBlackjack, VIDEO_POKER_PAYTABLE } from '../interactive-cards';
import type { Card } from '../../../rng/shoe';

const card = (rank: string, suit: Card['suit']): Card => ({ rank, suit });
const hand = (...parts: readonly (readonly [string, Card['suit']])[]): Card[] =>
  parts.map(([rank, suit]) => card(rank, suit));

const seeded = (seed = 12345) => createCardShoe(seed);

describe('Blackjack als Spielerrunde', () => {
  it('teilt zwei offene Spielerkarten und eine verdeckte Dealerkarte', () => {
    const round = startBlackjack(seeded());
    expect(round.player).toHaveLength(2);
    expect(round.dealer).toHaveLength(2);
    expect(round.phase).toBe('PLAYER');
    expect(round.units).toBe(1);
  });

  it('zaehlt weiche Asse und rechnet sie beim Platzen herunter', () => {
    expect(handTotal(hand(['A', '♠'], ['6', '♥']))).toBe(17);
    expect(handTotal(hand(['A', '♠'], ['A', '♥'], ['9', '♦']))).toBe(21);
    expect(handTotal(hand(['K', '♠'], ['Q', '♥'], ['5', '♦']))).toBe(25);
    expect(isSoftHand(hand(['A', '♠'], ['6', '♥']))).toBe(true);
    expect(isSoftHand(hand(['K', '♠'], ['6', '♥']))).toBe(false);
  });

  it('zieht auf Wunsch eine Karte und platzt bei ueber 21 sofort', () => {
    const shoe = seeded(777);
    let round = startBlackjack(shoe);
    round = { ...round, player: hand(['K', '♠'], ['Q', '♥']) };
    const afterHit = hitBlackjack(round, shoe);
    expect(afterHit.player).toHaveLength(3);
    expect(afterHit.phase).toBe('DONE');
    expect(afterHit.outcome).toBe('BUST');
    expect(afterHit.multiplierBps).toBe(0);
  });

  it('laesst den Dealer nach dem Halten bis mindestens 17 ziehen', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const shoe = seeded(seed * 31);
      let round = startBlackjack(shoe);
      if (round.phase === 'DONE') continue;
      round = standBlackjack(round, shoe);
      expect(handTotal(round.dealer)).toBeGreaterThanOrEqual(17);
      expect(round.phase).toBe('DONE');
      expect(['BLACKJACK', 'WIN', 'PUSH', 'LOSE', 'BUST']).toContain(round.outcome);
    }
  });

  it('zahlt Blackjack 3:2 und Gleichstand den Einsatz zurueck', () => {
    const shoe = seeded(4242);
    const base = startBlackjack(shoe);
    const blackjack = standBlackjack({ ...base, player: hand(['A', '♠'], ['K', '♥']), dealer: hand(['9', '♣'], ['7', '♦']) }, shoe);
    expect(blackjack.outcome).toBe('BLACKJACK');
    expect(blackjack.multiplierBps).toBe(25_000);
    const push = standBlackjack({ ...base, player: hand(['10', '♠'], ['9', '♥']), dealer: hand(['10', '♣'], ['9', '♦']) }, shoe);
    expect(push.outcome).toBe('PUSH');
    expect(push.multiplierBps).toBe(10_000);
  });

  it('verdoppelt nur mit genau zwei Karten und setzt den doppelten Einsatz', () => {
    const shoe = seeded(99);
    const round = startBlackjack(shoe);
    const doubled = doubleBlackjack(round, shoe);
    expect(doubled.units).toBe(2);
    expect(doubled.player).toHaveLength(3);
    expect(doubled.phase).toBe('DONE');
    const late = hitBlackjack(round, shoe);
    expect(() => doubleBlackjack(late, shoe)).toThrow(/verdoppeln/i);
  });
});

describe('Video Poker mit Hold und Draw', () => {
  it('erkennt die Raenge der 9/6-Tabelle', () => {
    expect(evaluateVideoPoker(hand(['A', '♠'], ['K', '♠'], ['Q', '♠'], ['J', '♠'], ['10', '♠'])).hand).toBe('ROYAL');
    expect(evaluateVideoPoker(hand(['9', '♥'], ['8', '♥'], ['7', '♥'], ['6', '♥'], ['5', '♥'])).bps).toBe(500_000);
    expect(evaluateVideoPoker(hand(['9', '♠'], ['9', '♥'], ['9', '♦'], ['9', '♣'], ['2', '♠'])).bps).toBe(250_000);
    expect(evaluateVideoPoker(hand(['K', '♠'], ['K', '♥'], ['4', '♦'], ['4', '♣'], ['2', '♠'])).bps).toBe(20_000);
    expect(evaluateVideoPoker(hand(['J', '♠'], ['J', '♥'], ['4', '♦'], ['7', '♣'], ['2', '♠'])).bps).toBe(10_000);
    expect(evaluateVideoPoker(hand(['J', '♠'], ['9', '♥'], ['4', '♦'], ['7', '♣'], ['2', '♠'])).bps).toBe(0);
  });

  it('erkennt die Strasse mit dem Ass unten', () => {
    const wheel = hand(['A', '♠'], ['2', '♥'], ['3', '♦'], ['4', '♣'], ['5', '♠']);
    expect(evaluateVideoPoker(wheel).hand).toBe('STRAIGHT');
    expect(evaluateVideoPoker(wheel).bps).toBe(40_000);
    const wheelFlush = hand(['A', '♥'], ['2', '♥'], ['3', '♥'], ['4', '♥'], ['5', '♥']);
    expect(evaluateVideoPoker(wheelFlush).hand).toBe('STRAIGHT_FLUSH');
    expect(evaluateVideoPoker(wheelFlush).bps).toBe(500_000);
  });

  it('fuehrt die komplette 9/6-Tabelle mit neun Zeilen', () => {
    expect(VIDEO_POKER_PAYTABLE).toHaveLength(9);
    expect(VIDEO_POKER_PAYTABLE[0]).toMatchObject({ hand: 'ROYAL', bps: 8_000_000 });
    expect(VIDEO_POKER_PAYTABLE[8]).toMatchObject({ hand: 'JACKS', bps: 10_000 });
  });

  it('behaelt gehaltene Karten und tauscht nur den Rest', () => {
    const shoe = seeded(2024);
    const dealt = Array.from({ length: 5 }, () => shoe.draw());
    const holds = [true, false, true, false, false];
    const result = drawVideoPoker(dealt, holds, shoe);
    expect(result.hand[0]).toEqual(dealt[0]);
    expect(result.hand[2]).toEqual(dealt[2]);
    expect(result.hand[1]).not.toEqual(dealt[1]);
    expect(result.hand).toHaveLength(5);
    expect(result.bps).toBe(evaluateVideoPoker(result.hand).bps);
  });

  it('zieht jede Karte nur einmal aus dem Schuh', () => {
    const shoe = seeded(555);
    const dealt = Array.from({ length: 5 }, () => shoe.draw());
    const before = shoe.remaining;
    drawVideoPoker(dealt, [false, false, false, false, false], shoe);
    expect(shoe.remaining).toBe(before - 5);
  });
});
