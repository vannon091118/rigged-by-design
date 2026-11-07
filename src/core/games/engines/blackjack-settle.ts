/** Dealerzug und Abrechnung: was jede Hand wert ist und wie die Runde endet. */
import type { Card, CardShoe } from '../../rng/shoe';
import {
  handTotal, isNatural, isSoftHand, mirror,
  type BlackjackHand, type BlackjackOutcome, type BlackjackRound, type BlackjackRules,
} from './blackjack-rules';

/** Haende, die noch zaehlen: aufgegeben und geplatzt spielt der Dealer nicht an. */
function liveHands(hands: readonly BlackjackHand[]): BlackjackHand[] {
  return hands.filter((hand) => !hand.surrendered && handTotal(hand.cards) <= 21);
}

function dealerPlays(dealer: readonly Card[], shoe: CardShoe, rules: BlackjackRules): Card[] {
  const cards = [...dealer];
  while (handTotal(cards) < 17
    || (handTotal(cards) === 17 && rules.dealerHitsSoft17 && isSoftHand(cards))) {
    cards.push(shoe.draw());
  }
  return cards;
}

function returnFor(hand: BlackjackHand, rules: BlackjackRules): number {
  if (hand.surrendered) return hand.units / 2;
  if (hand.outcome === 'BLACKJACK') return (hand.units * rules.blackjackBps) / 10_000;
  if (hand.outcome === 'WIN') return hand.units * 2;
  if (hand.outcome === 'PUSH') return hand.units;
  return 0;
}

function singleLabel(hand: BlackjackHand, dealerTotal: number): string {
  const total = handTotal(hand.cards);
  if (hand.surrendered) return 'Aufgegeben · halber Einsatz zurück';
  if (hand.outcome === 'BUST') return `Platzt mit ${total}`;
  if (hand.outcome === 'BLACKJACK') return 'BLACKJACK!';
  if (hand.outcome === 'PUSH') return `Push ${total}`;
  if (hand.outcome === 'WIN') return `Gewinnt ${total}:${dealerTotal}`;
  return `Verliert ${total}:${dealerTotal}`;
}

/** Abrechnung nach dem Dealerzug: jede Hand einzeln, Versicherung und Side Bet separat. */
export function settle(round: BlackjackRound, dealer: readonly Card[], rules: BlackjackRules): BlackjackRound {
  const dealerTotal = handTotal(dealer);
  const dealerNatural = isNatural(dealer);
  const hands = round.hands.map((hand) => {
    const total = handTotal(hand.cards);
    const natural = !hand.split && isNatural(hand.cards);
    const outcome: BlackjackOutcome | null = hand.surrendered ? null
      : total > 21 ? 'BUST'
        : natural && dealerNatural ? 'PUSH'
          : natural ? 'BLACKJACK'
            : dealerNatural ? 'LOSE'
              : dealerTotal > 21 || total > dealerTotal ? 'WIN'
                : total === dealerTotal ? 'PUSH' : 'LOSE';
    return { ...hand, done: true, outcome };
  });
  const insuranceReturn = round.insurance > 0 && dealerNatural ? round.insurance * 3 : 0;
  const sideReturn = round.sideBet && round.sideBetPair ? 12 : 0;
  const gross = hands.reduce((sum, hand) => sum + returnFor(hand, rules), 0) + insuranceReturn + sideReturn;
  const staked = hands.reduce((sum, hand) => sum + hand.units, 0) + round.insurance + (round.sideBet ? 1 : 0);
  const multiplierBps = Math.round((gross / Math.max(1e-9, staked)) * 10_000);
  const wins = hands.filter((hand) => hand.outcome === 'WIN' || hand.outcome === 'BLACKJACK').length;
  const label = hands.length === 1
    ? singleLabel(hands[0]!, dealerTotal)
    : `${wins}/${hands.length} Hände gewinnen gegen ${dealerTotal}`;
  return {
    ...mirror(round, hands, round.active), dealer, phase: 'DONE', outcome: hands[0]?.outcome ?? null,
    multiplierBps, units: staked, label,
  };
}

/** Naechste offene Hand; wenn keine mehr spielt, zieht der Dealer und es wird abgerechnet. */
export function advance(round: BlackjackRound, shoe: CardShoe, rules: BlackjackRules): BlackjackRound {
  const next = round.hands.findIndex((hand) => !hand.done);
  if (next >= 0) {
    const moved = mirror(round, round.hands as BlackjackHand[], next);
    return { ...moved, label: `Hand ${next + 1}: ${round.hands[next]!.label || `Deine ${handTotal(round.hands[next]!.cards)}`}` };
  }
  const dealer = liveHands(round.hands).length > 0 ? dealerPlays(round.dealer, shoe, rules) : round.dealer;
  return settle(round, dealer, rules);
}
