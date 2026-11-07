/**
 * @test-target: src/core/rng/shoe.ts
 * @error-code: ERR-1003
 *
 * Ein Schuh gibt jede Karte genau einmal aus, bevor er neu mischt.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../prng';
import { createShoe, DECK_SIZE } from '../shoe';
import { randomSeed } from '../../../test/random-seed';

const label = (card: { rank: string; suit: string }): string => `${card.rank}${card.suit}`;

describe('Kartenschuh', () => {
  it('gibt ein Deck ohne Dublette aus und mischt am Ende neu', () => {
    const shoe = createShoe(new Prng(randomSeed()));
    expect(shoe.remaining).toBe(DECK_SIZE);
    const first = new Set<string>();
    for (let index = 0; index < DECK_SIZE; index += 1) first.add(label(shoe.draw()));
    expect(first.size).toBe(DECK_SIZE);
    expect(shoe.remaining).toBe(0);

    const next = shoe.draw();
    expect(shoe.reshuffles).toBe(1);
    expect(first.has(label(next))).toBe(true);
    const second = new Set<string>([label(next)]);
    for (let index = 0; index < DECK_SIZE - 1; index += 1) second.add(label(shoe.draw()));
    expect(second.size).toBe(DECK_SIZE);
  });

  it('verteilt alle 52 Karten gleich haeufig ueber gezogene Haende', () => {
    const shoe = createShoe(new Prng(randomSeed()));
    const hands = 2_000;
    const counts = new Map<string, number>();
    for (let hand = 0; hand < hands; hand += 1) {
      for (let card = 0; card < 5; card += 1) {
        const dealt = label(shoe.draw());
        counts.set(dealt, (counts.get(dealt) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(DECK_SIZE);
    const expected = (hands * 5) / DECK_SIZE;
    for (const [card, count] of counts) {
      expect(Math.abs(count - expected) / expected, `Karte ${card}`).toBeLessThan(0.25);
    }
  });

  it('erzeugt fuer denselben Seed dieselbe Kartenfolge', () => {
    const seed = randomSeed();
    const a = createShoe(new Prng(seed));
    const b = createShoe(new Prng(seed));
    for (let index = 0; index < 30; index += 1) expect(a.draw()).toEqual(b.draw());
  });

  it('unterstuetzt mehrere Decks ohne Dublette innerhalb eines Decks', () => {
    const shoe = createShoe(new Prng(randomSeed()), 2);
    expect(shoe.remaining).toBe(DECK_SIZE * 2);
    const seen = new Map<string, number>();
    for (let index = 0; index < DECK_SIZE * 2; index += 1) {
      const card = label(shoe.draw());
      seen.set(card, (seen.get(card) ?? 0) + 1);
    }
    expect(seen.size).toBe(DECK_SIZE);
    for (const count of seen.values()) expect(count).toBe(2);
  });
});
