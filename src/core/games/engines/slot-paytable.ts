/**
 * Paytable und Gewinnlinien des Slots.
 *
 * Die Auszahlungsquote darf nicht davon abhaengen, wie viele Walzen ein Geraet
 * hat; die Kalibrierung dafuer liegt in `slot-odds.ts`. Hier steht nur, was
 * eine Walze zeigt und was eine getroffene Linie zahlt. Symbolgewichte und
 * Wild-Regel sind Parameter: dieselbe Paytable bedient jede Konfiguration.
 */
import type { Prng } from '../../rng/prng';

export const SLOT_SYMBOLS = ['BOOK', 'SCARAB', 'ANKH', 'EYE', 'URN', 'A', 'K', 'Q', 'J'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];
/** Gewicht je Symbol: wie oft es auf einer Walze erscheint. */
export type SlotWeights = Readonly<Record<SlotSymbol, number>>;

/** Standardgewicht; BOOK und SCARAB sind selten, J am haeufigsten. */
export const WEIGHTS: SlotWeights = {
  BOOK: 2, SCARAB: 4, ANKH: 6, EYE: 8, URN: 10, A: 14, K: 18, Q: 22, J: 30,
};

/** Auszahlung in Basispunkten des Linieneinsatzes fuer 3 / 4 / 5 Treffer. */
export const LINE_PAY: Readonly<Record<SlotSymbol, readonly [number, number, number]>> = {
  BOOK: [100_000, 1_000_000, 5_000_000],
  SCARAB: [50_000, 250_000, 1_000_000],
  ANKH: [20_000, 100_000, 400_000],
  EYE: [15_000, 60_000, 250_000],
  URN: [10_000, 40_000, 150_000],
  A: [5_000, 20_000, 80_000],
  K: [4_000, 15_000, 60_000],
  Q: [3_000, 10_000, 50_000],
  J: [2_000, 8_000, 40_000],
};

export const SLOT_ROWS = 3;
/** Freispiele je Ausloesung; Kalibrierung und Engine teilen die Zahl. */
export const FREE_SPINS = 10;
/** Skalierung, die bei fuenf Walzen gilt – gemessener 93-%-Saat. */
export const BASE_SCALE = 29.6;

/** Zehn Linien als Zeilenindex je Walze (0 = oben, 2 = unten), immer fuenf Felder. */
export const SLOT_LINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
];

const BY_REELS: Readonly<Record<number, readonly (readonly number[])[]>> = {
  3: [[1, 1, 1], [0, 0, 0], [2, 2, 2]],
  4: [[1, 1, 1, 1], [0, 0, 0, 0], [2, 2, 2, 2], [0, 1, 2, 1], [2, 1, 0, 1]],
  5: SLOT_LINES,
};

const MIN_REELS = 3;
const MAX_REELS = 5;

/** Walzenanzahl auf den Rahmen begrenzen; alte Stande koennen alles moegliche tragen. */
export function clampedReels(reels: number): number {
  if (!Number.isFinite(reels)) return MAX_REELS;
  return Math.max(MIN_REELS, Math.min(MAX_REELS, Math.round(reels)));
}

/** Die Gewinnlinien dieses Geraets: dieselbe Anzahl, die die Engine auswertet. */
export function slotPaylines(reels: number): readonly (readonly number[])[] {
  return BY_REELS[clampedReels(reels)] ?? SLOT_LINES;
}

/** Summe der Gewichte; 0 bedeutet: die Konfiguration ist unspielbar. */
export function weightTotal(weights: SlotWeights): number {
  return SLOT_SYMBOLS.reduce((sum, symbol) => sum + Math.max(0, weights[symbol]), 0);
}

/** Ein Wuerfelzug ueber die Walze: dieselbe Verteilung, die die Chancen ausweist. */
export function drawSymbol(prng: Prng, weights: SlotWeights = WEIGHTS): SlotSymbol {
  const total = weightTotal(weights);
  if (total <= 0) return 'J';
  let roll = prng.nextFloat() * total;
  for (const symbol of SLOT_SYMBOLS) {
    roll -= Math.max(0, weights[symbol]);
    if (roll < 0) return symbol;
  }
  return 'J';
}
