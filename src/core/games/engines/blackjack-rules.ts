/**
 * Tischregeln und Kartenarithmetik des Blackjacks: was erlaubt ist, was eine Hand
 * wert ist und wie eine Runde aussieht. Keine Aktion, kein Zug – nur der Vertrag.
 */
import type { Card } from '../../rng/shoe';

export interface BlackjackRules {
  /** Deckzahl des Schuhs; mehr Decks aendern die Zusammensetzung, nicht die Regeln. */
  readonly decks: number;
  /** H17: Dealer zieht auf weiche 17. S17 haelt sie. */
  readonly dealerHitsSoft17: boolean;
  /** Bruttorueckzahl eines Blackjacks in Basispunkten: 25 000 = 3:2, 22 000 = 6:5. */
  readonly blackjackBps: number;
  readonly allowInsurance: boolean;
  readonly allowSurrender: boolean;
  readonly allowSplit: boolean;
  /** Hoechstzahl der Haende nach Splits, inklusive der ersten. */
  readonly maxHands: number;
  /** Side Bet auf ein Paar: Bruttorueckzahl in Basispunkten, 0 schaltet sie ab. */
  readonly sideBetBps: number;
}

export const DEFAULT_BLACKJACK_RULES: BlackjackRules = {
  decks: 2,
  dealerHitsSoft17: false,
  blackjackBps: 25_000,
  allowInsurance: true,
  allowSurrender: true,
  allowSplit: true,
  maxHands: 4,
  sideBetBps: 0,
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

/** Fremde oder alte Regelwerte landen auf einem spielbaren Tisch, nie auf NaN. */
export function normalizeBlackjackRules(raw: unknown): BlackjackRules {
  const source = (raw ?? {}) as Partial<BlackjackRules>;
  const maxHands = clampInt(source.maxHands, DEFAULT_BLACKJACK_RULES.maxHands, 1, 4);
  return {
    decks: clampInt(source.decks, DEFAULT_BLACKJACK_RULES.decks, 1, 8),
    dealerHitsSoft17: source.dealerHitsSoft17 === true,
    blackjackBps: clampInt(source.blackjackBps, DEFAULT_BLACKJACK_RULES.blackjackBps, 20_000, 30_000),
    allowInsurance: source.allowInsurance !== false,
    allowSurrender: source.allowSurrender !== false,
    allowSplit: source.allowSplit !== false && maxHands > 1,
    maxHands,
    sideBetBps: clampInt(source.sideBetBps, 0, 0, 300_000),
  };
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

export type BlackjackOutcome = 'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSE' | 'BUST';

export interface BlackjackHand {
  readonly cards: readonly Card[];
  /** Einsatz in Einheiten; Verdopplung verdoppelt ihn. */
  readonly units: number;
  /** Aus einem Split entstanden: 21 ist dann kein Natural. */
  readonly split: boolean;
  readonly doubled: boolean;
  readonly done: boolean;
  readonly surrendered: boolean;
  readonly outcome: BlackjackOutcome | null;
  readonly label: string;
}

export interface BlackjackRound {
  readonly hands: readonly BlackjackHand[];
  readonly active: number;
  readonly dealer: readonly Card[];
  readonly phase: 'PLAYER' | 'DONE';
  /** Gesamteinsatz in Einheiten inklusive Verdopplung, Versicherung und Side Bet. */
  readonly units: number;
  readonly insurance: number;
  readonly insuranceOffered: boolean;
  readonly sideBet: boolean;
  readonly sideBetPair: boolean;
  readonly rules: BlackjackRules;
  readonly outcome: BlackjackOutcome | null;
  /** Netto-Quote auf den Gesamteinsatz; 10 000 heisst Einsatz zurueck. */
  readonly multiplierBps: number;
  readonly label: string;
  /** Aktive Hand fuer Tisch und Anzeige. */
  readonly player: readonly Card[];
  readonly split: boolean;
}

export const isNatural = (cards: readonly Card[]): boolean => cards.length === 2 && handTotal(cards) === 21;

export const sameRank = (a: Card, b: Card): boolean => rankValue(a.rank) === rankValue(b.rank);

export function sameCards(a: readonly Card[], b: readonly Card[]): boolean {
  return a.length === b.length && a.every((card, index) => card.rank === b[index]!.rank && card.suit === b[index]!.suit);
}

export function handLabel(hand: BlackjackHand): string {
  const total = handTotal(hand.cards);
  if (hand.surrendered) return `Aufgegeben (${total})`;
  if (total > 21) return `Platzt mit ${total}`;
  return `${total}${isSoftHand(hand.cards) ? ' weich' : ''}`;
}

/** Die aktive Hand spiegelt sich in `player`, damit Tisch und Anzeige nicht doppelt lesen. */
export function mirror(round: BlackjackRound, hands: readonly BlackjackHand[], active: number): BlackjackRound {
  const current = hands[Math.min(active, hands.length - 1)]!;
  return { ...round, hands, active, player: current.cards, split: hands.length > 1 };
}
