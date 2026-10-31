/**
 * @test-target: src/core/games/engines/blackjack.ts
 * @error-code: ERR-1003
 *
 * Die Runde gehoert dem Spieler: Split, Versicherung, Aufgeben und die
 * Tischregeln muessen ihn entscheiden lassen, nicht eine Automatik ersetzen.
 */
import { describe, expect, it } from 'vitest';
import type { Card, CardShoe } from '../../../rng/shoe';
import {
  DEFAULT_BLACKJACK_RULES, doubleBlackjack, handTotal, hitBlackjack, insuranceBlackjack,
  normalizeBlackjackRules, splitBlackjack, standBlackjack, startBlackjack, surrenderBlackjack,
} from '../blackjack';

/** Schuh aus vorgemerkten Karten: die Reihenfolge des Austeilens ist Teil des Tests. */
function shoeOf(...specs: string[]): CardShoe {
  const cards: Card[] = specs.map((spec) => ({
    rank: spec.slice(0, -1),
    suit: spec.slice(-1) as Card['suit'],
  }));
  return { remaining: cards.length, reshuffles: 0, draw: () => cards.shift() ?? { rank: '2', suit: '♠' } };
}

describe('Blackjack-Regeln', () => {
  it('teilt ein Paar in zwei Haende mit eigenem Einsatz und eigenen Karten', () => {
    const shoe = shoeOf('10♠', '10♥', '9♣', '7♦', '5♠', '6♥');
    const round = startBlackjack(shoe, 1);
    expect(round.hands).toHaveLength(1);
    const split = splitBlackjack(round, shoe);
    expect(split.hands).toHaveLength(2);
    expect(split.units).toBe(2);
    expect(split.hands.every((hand) => hand.cards.length === 2)).toBe(true);
    expect(split.hands.map((hand) => handTotal(hand.cards))).toEqual([15, 16]);
    expect(split.split).toBe(true);
  });

  it('gibt beim Aufgeben den halben Einsatz zurueck', () => {
    const shoe = shoeOf('10♠', '6♥', '9♣', '7♦');
    const round = surrenderBlackjack(startBlackjack(shoe, 1));
    expect(round.phase).toBe('DONE');
    expect(round.multiplierBps).toBe(5_000);
    expect(round.hands[0]!.surrendered).toBe(true);
  });

  it('zahlt die Versicherung nur bei einem Natural des Dealers aus', () => {
    const natural = shoeOf('10♠', '7♥', 'A♣', 'K♦');
    const insured = insuranceBlackjack(startBlackjack(natural, 1), shoeOf(), true);
    // 1 Einheit Hand + 0,5 Einheiten Versicherung; Natural zahlt 3x die Praemie.
    expect(insured.multiplierBps).toBe(10_000);
    expect(insured.phase).toBe('DONE');

    const plain = shoeOf('10♠', '7♥', 'A♣', '9♦', '5♣');
    const lost = insuranceBlackjack(startBlackjack(plain, 1), shoeOf('5♣'), true);
    expect(lost.phase).toBe('PLAYER');
    expect(lost.multiplierBps).toBe(0);
    expect(lost.insurance).toBe(0.5);
  });

  it('laesst H17 auf weicher 17 ziehen und S17 stehen', () => {
    const play = (dealerHitsSoft17: boolean) => {
      const shoe = shoeOf('10♠', '10♥', 'A♣', '6♦', '4♣');
      const round = startBlackjack(shoe, 1, normalizeBlackjackRules({ dealerHitsSoft17 }));
      return standBlackjack(round, shoe);
    };
    const hitRound = play(true);
    const standRound = play(false);
    expect(hitRound.dealer.map((card) => card.rank)).toContain('4');
    expect(standRound.dealer).toHaveLength(2);
    expect(standRound.multiplierBps).toBeGreaterThan(hitRound.multiplierBps);
  });

  it('zahlt Blackjack nach Tischregel 3:2 oder 6:5', () => {
    const shoe = () => shoeOf('A♠', 'K♥', '9♣', '7♦');
    const threeTwo = startBlackjack(shoe(), 1, normalizeBlackjackRules({ blackjackBps: 25_000 }));
    const sixFive = startBlackjack(shoe(), 1, normalizeBlackjackRules({ blackjackBps: 22_000 }));
    expect(threeTwo.multiplierBps).toBe(25_000);
    expect(sixFive.multiplierBps).toBe(22_000);
  });

  it('verdoppelt nur die aktive Hand und rechnet danach ab', () => {
    const shoe = shoeOf('5♠', '6♥', '9♣', '7♦', 'K♠');
    const round = startBlackjack(shoe, 1);
    const doubled = doubleBlackjack(round, shoe);
    expect(doubled.phase).toBe('DONE');
    expect(doubled.units).toBe(2);
    expect(doubled.hands[0]!.units).toBe(2);
    expect(doubled.hands[0]!.cards).toHaveLength(3);
  });

  it('blockiert Aktionen, die an diesem Tisch nicht erlaubt sind', () => {
    const rules = normalizeBlackjackRules({ ...DEFAULT_BLACKJACK_RULES, allowSurrender: false, allowSplit: false });
    const shoe = () => shoeOf('10♠', '10♥', '9♣', '7♦');
    expect(() => surrenderBlackjack(startBlackjack(shoe(), 1, rules))).toThrow(/nicht erlaubt/);
    expect(() => splitBlackjack(startBlackjack(shoe(), 1, rules), shoe())).toThrow(/nicht erlaubt/);
    expect(normalizeBlackjackRules({ decks: 99 }).decks).toBe(8);
    expect(normalizeBlackjackRules({ blackjackBps: 1 }).blackjackBps).toBe(20_000);
    expect(normalizeBlackjackRules({ decks: 99 }).blackjackBps).toBe(DEFAULT_BLACKJACK_RULES.blackjackBps);
  });

  it('fuehrt die Entscheidung des Spielers aus, statt sie zu ersetzen', () => {
    const shoe = shoeOf('10♠', '6♥', '9♣', '7♦', '3♠');
    const round = startBlackjack(shoe, 1);
    const afterHit = hitBlackjack(round, shoe);
    expect(afterHit.hands[0]!.cards).toHaveLength(3);
    expect(afterHit.phase).toBe('PLAYER');
    const stood = standBlackjack(afterHit, shoe);
    expect(stood.phase).toBe('DONE');
    expect(stood.dealer.length).toBeGreaterThanOrEqual(2);
  });
});
