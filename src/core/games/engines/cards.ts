/** Karten-Engines: Blackjack mit echten Entscheidungen, Video Poker mit Hold/Draw. */
import type { Prng } from '../../rng/prng';
import { createShoe, type Card } from '../../rng/shoe';

interface CardOutcome {
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
}

const cardLabel = (card: Card): string => `${card.rank}${card.suit}`;

function rankValue(rank: string): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** Weiches Ass: 11 wird zu 1, sobald die Hand platzt. */
function total(cards: readonly Card[]): number {
  let sum = 0;
  let aces = 0;
  for (const card of cards) {
    sum += rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces -= 1; }
  return sum;
}

/** Grundstrategie der Engine: bis 16 ziehen, ab 17 stehen, 11 verdoppeln. */
function playerChoice(state: { player: readonly Card[]; total: number }, canDouble: boolean): 'HIT' | 'STAND' | 'DOUBLE' {
  if (canDouble && state.total === 11) return 'DOUBLE';
  return state.total < 17 ? 'HIT' : 'STAND';
}

interface BlackjackRules {
  /** Dealer zieht auf weicher 17. */
  readonly dealerHitsSoft17?: boolean;
  /** Auszahlung fuer einen gewonnenen Vergleich in Basispunkten (2x = 20.000). */
  readonly winBps?: number;
  readonly blackjackBps?: number;
}

export function playBlackjack(prng: Prng, rules: BlackjackRules = {}): CardOutcome {
  const winBps = rules.winBps ?? 18_700;
  const blackjackBps = rules.blackjackBps ?? 23_000;
  const shoe = createShoe(prng, 2);
  const player: Card[] = [shoe.draw(), shoe.draw()];
  const dealer: Card[] = [shoe.draw(), shoe.draw()];
  let stakeFactor = 1;
  let doubled = false;
  let playerTotal = total(player);
  let choice = playerChoice({ player, total: playerTotal }, player.length === 2);
  while (choice !== 'STAND' && playerTotal < 21) {
    if (choice === 'DOUBLE') { stakeFactor = 2; doubled = true; }
    player.push(shoe.draw());
    playerTotal = total(player);
    if (playerTotal >= 21) break;
    choice = playerChoice({ player, total: playerTotal }, false);
  }
  let dealerTotal = total(dealer);
  while (dealerTotal < 17 || (dealerTotal === 17 && rules.dealerHitsSoft17 === true && dealer.some((card) => card.rank === 'A'))) {
    dealer.push(shoe.draw());
    dealerTotal = total(dealer);
  }
  const playerBlackjack = player.length === 2 && playerTotal === 21;
  const dealerBlackjack = dealer.length === 2 && dealerTotal === 21;
  const bust = playerTotal > 21;
  const multiplierBps = bust ? 0
    : dealerBlackjack && !playerBlackjack ? 0
      : playerBlackjack && !dealerBlackjack ? blackjackBps
        : dealerTotal > 21 || playerTotal > dealerTotal ? winBps
          : playerTotal === dealerTotal ? 10_000
            : 0;
  const net = Math.round(multiplierBps * stakeFactor);
  const shown = doubled ? `${cardLabel(player[0]!)} ${cardLabel(player[1]!)} +${cardLabel(player[2]!)} (verdoppelt)` : player.map(cardLabel).join(' ');
  return {
    multiplierBps: Math.min(net, 50_000),
    label: bust ? `Platzt mit ${playerTotal}` : playerTotal > dealerTotal ? `Gewinnt ${playerTotal}:${dealerTotal}` : playerTotal === dealerTotal ? `Push ${playerTotal}` : `Verliert ${playerTotal}:${dealerTotal}`,
    detail: [shown, `gegen ${dealer.map(cardLabel).join(' ')} (${dealerTotal})`],
  };
}

// ------------------------------------------------------------- Video Poker

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JACK_INDEX = RANK_ORDER.indexOf('J');

type PokerHand = 'ROYAL' | 'STRAIGHT_FLUSH' | 'QUADS' | 'FULL_HOUSE' | 'FLUSH'
  | 'STRAIGHT' | 'TRIPS' | 'TWO_PAIR' | 'JACKS' | 'NOTHING';

/** Jacks-or-Better als Daten, in Basispunkten des Einsatzes. */
const PAYTABLE: Readonly<Record<PokerHand, number>> = {
  // Full House 9x und Flush 6x wie bei 9/6; die kleinen Raenge sind auf die
  // einfache Hold-Strategie kalibriert und ergeben ~93 % RTP.
  ROYAL: 2_500_000, STRAIGHT_FLUSH: 500_000, QUADS: 250_000, FULL_HOUSE: 90_000,
  FLUSH: 60_000, STRAIGHT: 40_000, TRIPS: 26_500, TWO_PAIR: 18_000, JACKS: 9_600, NOTHING: 0,
};

function evaluatePokerHand(cards: readonly Card[]): { hand: PokerHand; bps: number } {
  const ranks = cards.map((card) => RANK_ORDER.indexOf(card.rank)).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const shape = [...counts.values()].sort((a, b) => b - a);
  const flush = new Set(cards.map((card) => card.suit)).size === 1;
  const straight = ranks.every((rank, index) => index === 0 || rank === ranks[index - 1]! + 1);
  const royal = straight && ranks[0] === RANK_ORDER.indexOf('10');
  const hand: PokerHand = royal ? 'ROYAL'
    : straight && flush ? 'STRAIGHT_FLUSH'
      : shape[0] === 4 ? 'QUADS'
        : shape[0] === 3 && shape[1] === 2 ? 'FULL_HOUSE'
          : flush ? 'FLUSH'
            : straight ? 'STRAIGHT'
              : shape[0] === 3 ? 'TRIPS'
                : shape[0] === 2 && shape[1] === 2 ? 'TWO_PAIR'
                  : shape[0] === 2 && ranks.some((rank) => counts.get(rank) === 2 && rank >= JACK_INDEX)
                    ? 'JACKS' : 'NOTHING';
  return { hand, bps: PAYTABLE[hand] };
}

/**
 * Fuenf Karten, Hold-Auswahl, Nachziehen. Ohne Hold-Auswahl haelt die Engine
 * nach einfacher Strategie: alles ab einem Paar.
 */
export function playVideoPoker(prng: Prng, holds?: readonly boolean[]): CardOutcome {
  const shoe = createShoe(prng);
  const dealt = Array.from({ length: 5 }, () => shoe.draw());
  const keep = holds ?? dealt.map((_, index) => {
    const probe = evaluatePokerHand(dealt);
    if (probe.bps >= PAYTABLE.FULL_HOUSE) return true;
    const counts = new Map<string, number>();
    for (const entry of dealt) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
    return (counts.get(dealt[index]!.rank) ?? 0) > 1;
  });
  const final = dealt.map((card, index) => (keep[index] ? card : shoe.draw()));
  const { hand, bps } = evaluatePokerHand(final);
  return {
    multiplierBps: bps,
    label: bps > 0 ? `${hand} ${(bps / 10_000).toFixed(2)}x`.replace('.', ',') : 'Nichts',
    detail: final.map(cardLabel),
  };
}
