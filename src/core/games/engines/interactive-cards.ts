/**
 * Kartenrunden mit Spielerentscheidung: Blackjack Zug fuer Zug, Video Poker mit Hold.
 * Derselbe Schuh wie im schnellen Auto-Modus - nur ohne Grundstrategie.
 */
import { Prng } from '../../rng/prng';
import { createShoe, type Card, type CardShoe } from '../../rng/shoe';

/** Eigener Schuh je Sitzung; der Seed kommt aus dem Welt-PRNG des Stores. */
export function createCardShoe(seed: number, decks = 2): CardShoe {
  return createShoe(new Prng(seed >>> 0), decks);
}

function rankValue(rank: string): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10;
  return Number(rank);
}

export function handTotal(cards: readonly Card[]): number {
  let sum = 0;
  let aces = 0;
  for (const card of cards) {
    sum += rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces -= 1; }
  return sum;
}

/** Weich heisst: ein Ass zaehlt noch als 11. */
export function isSoftHand(cards: readonly Card[]): boolean {
  const hard = cards.reduce((sum, card) => sum + (card.rank === 'A' ? 1 : rankValue(card.rank)), 0);
  return cards.some((card) => card.rank === 'A') && hard + 10 <= 21;
}

type BlackjackOutcome = 'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSE' | 'BUST';
const BLACKJACK_PAYS: Readonly<Record<'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSE' | 'BUST', number>> = {
  BLACKJACK: 25_000, WIN: 20_000, PUSH: 10_000, LOSE: 0, BUST: 0,
};

export interface BlackjackRound {
  readonly player: readonly Card[];
  readonly dealer: readonly Card[];
  readonly units: 1 | 2;
  readonly phase: 'PLAYER' | 'DONE';
  readonly outcome: BlackjackOutcome | null;
  /** Netto-Quote relativ zum Gesamteinsatz (auch nach Verdopplung). */
  readonly multiplierBps: number;
  readonly label: string;
}

const DEALER_STANDS_ON = 17;

/** Dealer zieht, bis er 17 erreicht; weiche 17 wird gehalten (S17). */
function dealerPlay(dealer: readonly Card[], shoe: CardShoe): Card[] {
  const cards = [...dealer];
  while (handTotal(cards) < DEALER_STANDS_ON) cards.push(shoe.draw());
  return cards;
}

function settle(player: readonly Card[], dealer: readonly Card[], units: 1 | 2): BlackjackRound {
  const playerTotal = handTotal(player);
  const dealerTotal = handTotal(dealer);
  const playerNatural = player.length === 2 && playerTotal === 21;
  const dealerNatural = dealer.length === 2 && dealerTotal === 21;
  const outcome: BlackjackOutcome = playerTotal > 21 ? 'BUST'
    : playerNatural && dealerNatural ? 'PUSH'
      : playerNatural ? 'BLACKJACK'
        : dealerNatural ? 'LOSE'
          : dealerTotal > 21 || playerTotal > dealerTotal ? 'WIN'
            : playerTotal === dealerTotal ? 'PUSH' : 'LOSE';
  const label = outcome === 'BUST' ? `Platzt mit ${playerTotal}`
    : outcome === 'BLACKJACK' ? 'BLACKJACK!'
      : outcome === 'PUSH' ? `Push ${playerTotal}`
        : outcome === 'WIN' ? `Gewinnt ${playerTotal}:${dealerTotal}`
          : `Verliert ${playerTotal}:${dealerTotal}`;
  return {
    player, dealer, units, phase: 'DONE', outcome,
    multiplierBps: BLACKJACK_PAYS[outcome], label,
  };
}

export function startBlackjack(shoe: CardShoe, units: 1 | 2 = 1): BlackjackRound {
  const player = [shoe.draw(), shoe.draw()];
  const dealer = [shoe.draw(), shoe.draw()];
  const total = handTotal(player);
  // Ein naturales Blatt wird sofort abgerechnet, sonst spielt der Spieler.
  if (total === 21) return settle(player, dealer, units);
  return { player, dealer, units, phase: 'PLAYER', outcome: null, multiplierBps: 0, label: `Deine ${total}` };
}

export function hitBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  if (round.phase !== 'PLAYER') throw new Error('Die Runde ist schon vorbei.');
  const player = [...round.player, shoe.draw()];
  const total = handTotal(player);
  if (total > 21) return settle(player, round.dealer, round.units);
  if (total === 21) return standBlackjack({ ...round, player }, shoe);
  return { ...round, player, label: `Deine ${total}${isSoftHand(player) ? ' (weich)' : ''}` };
}

export function standBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  if (round.phase !== 'PLAYER') throw new Error('Die Runde ist schon vorbei.');
  return settle(round.player, dealerPlay(round.dealer, shoe), round.units);
}

/** Verdoppeln: genau eine Karte, doppelter Einsatz, danach zieht der Dealer. */
export function doubleBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  if (round.phase !== 'PLAYER' || round.player.length !== 2 || round.units !== 1) {
    throw new Error('Verdoppeln geht nur mit zwei Karten und vor dem ersten Zug.');
  }
  const player = [...round.player, shoe.draw()];
  return settle(player, dealerPlay(round.dealer, shoe), 2);
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
