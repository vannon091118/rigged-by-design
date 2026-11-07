/**
 * @test-target: src/core/games/engines/cards.ts
 * @error-code: ERR-1003
 */
import { describe, expect, it } from 'vitest';
import type { Card } from '../../rng/shoe';
import { evaluatePokerHand } from '../engines/cards';

const card = (rank: string, suit: string): Card => ({ rank, suit }) as unknown as Card;

describe('Video-Poker-Raenge', () => {
  it('zahlt Royal Flush nur in einer Farbe', () => {
    const hand = evaluatePokerHand([card('10', 'S'), card('J', 'S'), card('Q', 'S'), card('K', 'S'), card('A', 'S')]);
    expect(hand.hand).toBe('ROYAL');
  });

  it('wertet eine farblose 10-bis-Ass-Strasse als Strasse, nicht als Royal', () => {
    const hand = evaluatePokerHand([card('10', 'S'), card('J', 'H'), card('Q', 'D'), card('K', 'C'), card('A', 'S')]);
    expect(hand.hand).toBe('STRAIGHT');
  });

  it('erkennt das Wheel Ass-2-3-4-5 als Strasse', () => {
    const hand = evaluatePokerHand([card('A', 'S'), card('2', 'H'), card('3', 'D'), card('4', 'C'), card('5', 'S')]);
    expect(hand.hand).toBe('STRAIGHT');
  });

  it('erkennt das Wheel in einer Farbe als Straight Flush', () => {
    const hand = evaluatePokerHand([card('A', 'S'), card('2', 'S'), card('3', 'S'), card('4', 'S'), card('5', 'S')]);
    expect(hand.hand).toBe('STRAIGHT_FLUSH');
  });
});
