/** Kartenschuh ohne Zuruecklegen: eine gezogene Karte verlaesst den Schuh wirklich. */
import type { Prng } from './prng';

type CardSuit = '♠' | '♥' | '♦' | '♣';

export interface Card {
  readonly rank: string;
  readonly suit: CardSuit;
}

export interface CardShoe {
  readonly remaining: number;
  readonly reshuffles: number;
  draw(): Card;
}

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
const SUITS: readonly CardSuit[] = ['♠', '♥', '♦', '♣'];
export const DECK_SIZE = RANKS.length * SUITS.length;

/**
 * Baut einen Schuh mit `decks` vollstaendigen Decks. Jede Ziehung nimmt eine Karte
 * dauerhaft heraus; erst wenn der Schuh leer ist, wird er neu gemischt.
 */
export function createShoe(prng: Prng, decks = 1): CardShoe {
  if (!Number.isInteger(decks) || decks < 1) throw new Error(`createShoe: decks ${decks} ungueltig`);
  const order: number[] = [];
  for (let deck = 0; deck < decks; deck += 1) {
    for (let id = 0; id < DECK_SIZE; id += 1) order.push(id);
  }
  let position = 0;
  let reshuffles = 0;
  return {
    get remaining() { return order.length - position; },
    get reshuffles() { return reshuffles; },
    draw(): Card {
      if (position >= order.length) {
        position = 0;
        reshuffles += 1;
      }
      // Partielles Fisher-Yates: ein Tausch pro Ziehung, uniforme Auswahl aus dem Rest.
      const pick = position + prng.nextInt(0, order.length - 1 - position);
      const swap = order[position]!;
      order[position] = order[pick]!;
      order[pick] = swap;
      const id = order[position]!;
      position += 1;
      return { rank: RANKS[id % RANKS.length]!, suit: SUITS[Math.floor(id / RANKS.length)]! };
    },
  };
}
