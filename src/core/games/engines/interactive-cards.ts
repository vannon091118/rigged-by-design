/**
 * Kartenrunden mit Spielerentscheidung: Blackjack Zug fuer Zug, Video Poker mit Hold.
 * Derselbe Schuh wie im schnellen Auto-Modus - nur ohne Grundstrategie.
 *
 * Blackjack selbst liegt in `blackjack.ts`; hier bleibt der Schuh und das Video Poker.
 * Die Namen werden weitergegeben, damit Anzeige und Tests ihren Pfad behalten.
 */
import { Prng } from '../../rng/prng';
import { createShoe, type Card, type CardShoe } from '../../rng/shoe';

export {
  DEFAULT_BLACKJACK_RULES, doubleBlackjack, handTotal, hitBlackjack, insuranceBlackjack, isSoftHand,
  normalizeBlackjackRules, splitBlackjack, standBlackjack, startBlackjack, surrenderBlackjack,
  type BlackjackRound, type BlackjackRules,
} from './blackjack';

/** Eigener Schuh je Sitzung; der Seed kommt aus dem Welt-PRNG des Stores. */
export function createCardShoe(seed: number, decks = 2): CardShoe {
  return createShoe(new Prng(seed >>> 0), decks);
}

// ------------------------------------------------------------- Video Poker

export type VideoPokerHand = 'ROYAL' | 'STRAIGHT_FLUSH' | 'QUADS' | 'FULL_HOUSE' | 'FLUSH'
  | 'STRAIGHT' | 'TRIPS' | 'TWO_PAIR' | 'JACKS';

interface PaytableRow {
  readonly hand: VideoPokerHand;
  readonly label: string;
  /** Auszahlung in Basispunkten des Einsatzes (10.000 = Einsatz zurueck). */
  readonly bps: number;
}

/** 9/6 Jacks or Better: Full House 9, Flush 6, alles andere wie gedruckt. */
export const VIDEO_POKER_PAYTABLE: readonly PaytableRow[] = [
  { hand: 'ROYAL', label: 'Royal Flush', bps: 8_000_000 },
  { hand: 'STRAIGHT_FLUSH', label: 'Straight Flush', bps: 500_000 },
  { hand: 'QUADS', label: 'Vierling', bps: 250_000 },
  { hand: 'FULL_HOUSE', label: 'Full House', bps: 90_000 },
  { hand: 'FLUSH', label: 'Flush', bps: 60_000 },
  { hand: 'STRAIGHT', label: 'Strasse', bps: 40_000 },
  { hand: 'TRIPS', label: 'Drilling', bps: 30_000 },
  { hand: 'TWO_PAIR', label: 'Zwei Paare', bps: 20_000 },
  { hand: 'JACKS', label: 'Jacks or Better', bps: 10_000 },
];

const ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JACK = ORDER.indexOf('J');

interface VideoPokerResult {
  readonly hand: VideoPokerHand | 'NOTHING';
  readonly bps: number;
  readonly label: string;
}

/** Rang der fuenf Karten; alles unter zwei Bildern ist nichts wert. */
export function evaluateVideoPoker(cards: readonly Card[]): VideoPokerResult {
  const ranks = cards.map((card) => ORDER.indexOf(card.rank)).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const shape = [...counts.values()].sort((a, b) => b - a);
  const flush = new Set(cards.map((card) => card.suit)).size === 1;
  const straightHigh = ranks.every((rank, index) => index === 0 || rank === ranks[index - 1]! + 1);
  // Ass kann auch unten zaehlen: A-2-3-4-5 ist eine Strasse, keine "nichts".
  const wheel = ranks.length === 5
    && ranks[0] === ORDER.indexOf('2') && ranks[1] === ORDER.indexOf('3')
    && ranks[2] === ORDER.indexOf('4') && ranks[3] === ORDER.indexOf('5')
    && ranks[4] === ORDER.indexOf('A');
  const straight = straightHigh || wheel;
  const royal = straightHigh && ranks[0] === ORDER.indexOf('10');
  const pairHigh = [...counts.entries()].some(([rank, count]) => count === 2 && rank >= JACK);
  const hand: VideoPokerHand | 'NOTHING' = royal && flush ? 'ROYAL'
    : straight && flush ? 'STRAIGHT_FLUSH'
      : shape[0] === 4 ? 'QUADS'
        : shape[0] === 3 && shape[1] === 2 ? 'FULL_HOUSE'
          : flush ? 'FLUSH'
            : straight ? 'STRAIGHT'
              : shape[0] === 3 ? 'TRIPS'
                : shape[0] === 2 && shape[1] === 2 ? 'TWO_PAIR'
                  : pairHigh ? 'JACKS' : 'NOTHING';
  const row = VIDEO_POKER_PAYTABLE.find((entry) => entry.hand === hand);
  return { hand, bps: row?.bps ?? 0, label: row?.label ?? 'Nichts' };
}

export function dealVideoPoker(shoe: CardShoe): Card[] {
  return Array.from({ length: 5 }, () => shoe.draw());
}

/** Gehaltene Karten bleiben stehen, der Rest kommt frisch aus dem Schuh. */
export function drawVideoPoker(
  dealt: readonly Card[], holds: readonly boolean[], shoe: CardShoe,
): { hand: Card[]; bps: number; label: string } {
  const hand = dealt.map((card, index) => (holds[index] ? card : shoe.draw()));
  const result = evaluateVideoPoker(hand);
  return { hand, bps: result.bps, label: result.label };
}
