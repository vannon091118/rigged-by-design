/** Fuenf- bis Siebenkarten-Bewertung fuer den Rundenpoker-Tisch. */
import type { Card } from '../rng/shoe';

const RANK_VALUE: Readonly<Record<string, number>> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

/** Kategorien in aufsteigendem Wert; der Index ist die Kategorie des HandRanks. */
const CAT_NAME = [
  'Hohes Karte', 'Paar', 'Zwei Paar', 'Drei einerlei', 'Straße',
  'Farbe', 'Full House', 'Vier einerlei', 'Straßenfarbe',
] as const;

export interface HandRank {
  readonly cat: number;
  readonly kickers: readonly number[];
}

export function rankValue(rank: string): number {
  return RANK_VALUE[rank] ?? 0;
}

/** Vergleichbar wie eine Zahl: groesser heisst besser. */
export function compareRank(a: HandRank, b: HandRank): number {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let index = 0; index < len; index += 1) {
    const diff = (a.kickers[index] ?? 0) - (b.kickers[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function handName(rank: HandRank): string {
  if (rank.cat === 8 && rank.kickers[0] === 14) return 'Royal Flush';
  return CAT_NAME[rank.cat] ?? 'unbekannt';
}

/** Genau fuenf Karten: Zählung, Farbe, Straße – in einer festen Priorität. */
function scoreFive(cards: readonly Card[]): HandRank {
  const values = cards.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
  const flush = cards.every((card) => card.suit === cards[0]!.suit);
  const unique = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0]! - unique[4]! === 4) straightHigh = unique[0]!;
    else if (unique[0] === 14 && unique[1] === 5) straightHigh = 5;
  }
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const singles = groups.filter((group) => group[1] === 1).map((group) => group[0]);
  const [top, second, third] = groups;
  if (straightHigh > 0 && flush) return { cat: 8, kickers: [straightHigh] };
  if (top![1] === 4) return { cat: 7, kickers: [top![0], second![0]] };
  if (top![1] === 3 && second![1] === 2) return { cat: 6, kickers: [top![0], second![0]] };
  if (flush) return { cat: 5, kickers: values };
  if (straightHigh > 0) return { cat: 4, kickers: [straightHigh] };
  if (top![1] === 3) return { cat: 3, kickers: [top![0], ...singles] };
  if (top![1] === 2 && second![1] === 2) return { cat: 2, kickers: [top![0], second![0], third![0]] };
  if (top![1] === 2) return { cat: 1, kickers: [top![0], ...singles] };
  return { cat: 0, kickers: values };
}

/** Beste Fuenferkombination aus fuenf bis sieben Karten (bei sieben Karten 21 Kandidaten). */
export function bestHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5) throw new Error(`bestHand: ${cards.length} Karten sind zu wenig`);
  let best: HandRank | null = null;
  const count = cards.length;
  for (let a = 0; a < count - 4; a += 1) {
    for (let b = a + 1; b < count - 3; b += 1) {
      for (let c = b + 1; c < count - 2; c += 1) {
        for (let d = c + 1; d < count - 1; d += 1) {
          for (let e = d + 1; e < count; e += 1) {
            const rank = scoreFive([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (!best || compareRank(rank, best) > 0) best = rank;
          }
        }
      }
    }
  }
  return best!;
}
