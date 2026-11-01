/**
 * Blackjack mit echten Entscheidungen: Ziehen, Halten, Verdoppeln, Split,
 * Versicherung und Aufgeben. Der Spieler fuehrt die Hand – die Engine zieht
 * nur den Dealer und rechnet ab. Tischregeln (Deckzahl, S17/H17, 3:2 oder 6:5,
 * erlaubte Aktionen, Side Bet) sind Konfiguration, keine festen Konstanten.
 */
import type { Card, CardShoe } from '../../rng/shoe';
import {
  DEFAULT_BLACKJACK_RULES, handLabel, handTotal, isNatural, mirror, normalizeBlackjackRules, sameCards, sameRank,
  type BlackjackHand, type BlackjackRound, type BlackjackRules,
} from './blackjack-rules';
import { advance, settle } from './blackjack-settle';

export {
  DEFAULT_BLACKJACK_RULES, handTotal, isSoftHand, normalizeBlackjackRules,
  type BlackjackHand, type BlackjackRound, type BlackjackRules,
} from './blackjack-rules';

function withHand(round: BlackjackRound, index: number, patch: Partial<BlackjackHand>): BlackjackHand[] {
  return round.hands.map((hand, at) => (at === index ? { ...hand, ...patch } : hand));
}

/** Tischregeln und Zustand in eine Runde giessen; `player` bleibt die aktive Hand. */
function build(
  hands: readonly BlackjackHand[], dealer: readonly Card[], units: number,
  rules: BlackjackRules, extra: Partial<BlackjackRound> = {},
): BlackjackRound {
  const base: BlackjackRound = {
    hands, active: 0, dealer, phase: 'PLAYER', units, insurance: 0, insuranceOffered: false,
    sideBet: false, sideBetPair: false, rules, outcome: null, multiplierBps: 0,
    label: '', player: hands[0]?.cards ?? [], split: hands.length > 1, ...extra,
  };
  return { ...base, label: base.label || `Deine ${handLabel(hands[0]!)}` };
}

/**
 * Alte Runden kennen nur `player`; wer ein Blatt von Hand zusammenstellt, bekommt
 * daraus wieder eine Hand. Sonst wuerde die Abrechnung ein fremdes Blatt lesen.
 */
function aligned(round: BlackjackRound): BlackjackRound {
  if (round.hands.length !== 1) return round;
  const hand = round.hands[0]!;
  if (sameCards(hand.cards, round.player)) return round;
  const rebuilt: BlackjackHand = { ...hand, cards: round.player, units: round.units };
  return { ...round, hands: [rebuilt], player: rebuilt.cards };
}

export function startBlackjack(
  shoe: CardShoe,
  units: 1 | 2 = 1,
  rawRules: BlackjackRules = DEFAULT_BLACKJACK_RULES,
  sideBet = false,
): BlackjackRound {
  const rules = normalizeBlackjackRules(rawRules);
  const player = [shoe.draw(), shoe.draw()];
  const dealer = [shoe.draw(), shoe.draw()];
  const dealt: BlackjackHand = {
    cards: player, units, split: false, doubled: false, done: false, surrendered: false, outcome: null, label: '',
  };
  const hand: BlackjackHand = { ...dealt, label: handLabel(dealt) };
  const sideBetPair = sideBet && rules.sideBetBps > 0 && sameRank(player[0]!, player[1]!);
  const base = build([hand], dealer, units + (sideBet ? 1 : 0), rules, { sideBet, sideBetPair });
  // Ein Natural des Spielers beendet die Hand sofort; erst dann wird die Versicherung angeboten,
  // damit bei Ablehnung automatisch abgerechnet werden kann (alle Hände sind done).
  if (isNatural(player)) {
    const baseDone = { ...base, hands: [{ ...hand, done: true }] };
    if (rules.allowInsurance && dealer[0]!.rank === 'A') {
      return { ...baseDone, insuranceOffered: true, label: 'Der Dealer zeigt ein Ass. Versicherung?' };
    }
    return advance(baseDone, shoe, rules);
  }
  // Ein Ass beim Dealer ist die einzige Situation, die vor dem Spielzug geklaert wird.
  if (rules.allowInsurance && dealer[0]!.rank === 'A') {
    return { ...base, insuranceOffered: true, label: 'Der Dealer zeigt ein Ass. Versicherung?' };
  }
  return base;
}

/** Versicherung annehmen oder ablehnen; bei einem Natural des Dealers endet die Runde sofort. */
export function insuranceBlackjack(round: BlackjackRound, shoe: CardShoe, take: boolean): BlackjackRound {
  if (round.phase !== 'PLAYER' || !round.insuranceOffered) throw new Error('Keine Versicherung offen.');
  if (!take) {
    const cleared = { ...round, insuranceOffered: false, label: 'Ohne Versicherung weiter.' };
    return round.hands.every((hand) => hand.done) ? advance(cleared, shoe, round.rules) : cleared;
  }
  const insured: BlackjackRound = { ...round, insurance: 0.5, units: round.units + 0.5, insuranceOffered: false };
  if (isNatural(round.dealer)) return settle(insured, round.dealer, round.rules);
  const lost = { ...insured, label: 'Ass ohne Blackjack – Versicherung ist weg.' };
  return round.hands.every((hand) => hand.done) ? advance(lost, shoe, round.rules) : lost;
}

export function hitBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  const current = aligned(round);
  if (current.phase !== 'PLAYER') throw new Error('Die Runde ist schon vorbei.');
  const hand = current.hands[current.active]!;
  if (hand.done) throw new Error('Diese Hand ist abgeschlossen.');
  const cards = [...hand.cards, shoe.draw()];
  const total = handTotal(cards);
  const next: BlackjackHand = { ...hand, cards, done: total >= 21, label: handLabel({ ...hand, cards }) };
  const moved = mirror(current, withHand(current, current.active, next), current.active);
  return advance({ ...moved, label: `Deine ${next.label}` }, shoe, current.rules);
}

export function standBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  const current = aligned(round);
  if (current.phase !== 'PLAYER') throw new Error('Die Runde ist schon vorbei.');
  const hands = withHand(current, current.active, { done: true });
  return advance(mirror(current, hands, current.active), shoe, current.rules);
}

/** Verdoppeln: doppelter Einsatz auf genau diese Hand, eine Karte, dann ist sie fertig. */
export function doubleBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  const current = aligned(round);
  if (current.phase !== 'PLAYER' || current.active >= current.hands.length) {
    throw new Error('Die Runde ist schon vorbei.');
  }
  const hand = current.hands[current.active]!;
  if (hand.cards.length !== 2 || hand.done) throw new Error('Verdoppeln geht nur mit zwei Karten.');
  const cards = [...hand.cards, shoe.draw()];
  const doubled: BlackjackHand = { ...hand, cards, units: hand.units * 2, doubled: true, done: true };
  const hands = withHand(current, current.active, doubled);
  const units = current.units + hand.units;
  return advance(mirror({ ...current, units }, hands, current.active), shoe, current.rules);
}

/** Split: zwei gleiche Raenge werden zu zwei Haenden, jede bekommt eine neue Karte. */
export function splitBlackjack(round: BlackjackRound, shoe: CardShoe): BlackjackRound {
  const current = aligned(round);
  const rules = current.rules;
  if (current.phase !== 'PLAYER') throw new Error('Die Runde ist schon vorbei.');
  if (!rules.allowSplit) throw new Error('Split ist an diesem Tisch nicht erlaubt.');
  const hand = current.hands[current.active]!;
  if (hand.cards.length !== 2 || hand.done) throw new Error('Split geht nur mit zwei Karten.');
  if (current.hands.length >= rules.maxHands) throw new Error('Mehr Haende sind an diesem Tisch nicht erlaubt.');
  const [first, second] = hand.cards as [Card, Card];
  if (!sameRank(first, second)) throw new Error('Split verlangt zwei gleiche Raenge.');
  const left: BlackjackHand = { ...hand, cards: [first, shoe.draw()], split: true, units: 1 };
  const right: BlackjackHand = { ...hand, cards: [second, shoe.draw()], split: true, units: 1 };
  // Ein Ass-Paar bekommt je eine Karte und ist dann fertig, wie an echten Tischen.
  const aces = first.rank === 'A';
  const finishedLeft: BlackjackHand = { ...left, done: aces || handTotal(left.cards) === 21, label: '' };
  const finishedRight: BlackjackHand = { ...right, done: aces || handTotal(right.cards) === 21, label: '' };
  const hands = [
    ...current.hands.slice(0, current.active), finishedLeft, finishedRight, ...current.hands.slice(current.active + 1),
  ];
  const units = current.units + hand.units;
  const next = { ...mirror(current, hands, current.active), units };
  return finishedLeft.done ? advance(next, shoe, current.rules) : next;
}

/** Aufgeben: halber Einsatz zurueck, nur mit zwei Karten und ohne Split. */
export function surrenderBlackjack(round: BlackjackRound): BlackjackRound {
  const current = aligned(round);
  const hand = current.hands[current.active]!;
  if (current.phase !== 'PLAYER' || current.hands.length > 1) throw new Error('Aufgeben geht nur vor dem Split.');
  if (!current.rules.allowSurrender) throw new Error('Aufgeben ist an diesem Tisch nicht erlaubt.');
  if (hand.cards.length !== 2) throw new Error('Aufgeben geht nur mit zwei Karten.');
  const surrendered: BlackjackHand = { ...hand, done: true, surrendered: true };
  return settle({ ...current, hands: [surrendered] }, current.dealer, current.rules);
}
