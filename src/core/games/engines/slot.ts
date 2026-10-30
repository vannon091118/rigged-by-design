/** Book-of-VaCoin: 5x3-Walzen, zehn Gewinnlinien, gewichtete Symbole, Freispiele. */
import type { Prng } from '../../rng/prng';

interface SlotOutcome {
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
}

const SYMBOLS = ['BOOK', 'SCARAB', 'ANKH', 'EYE', 'URN', 'A', 'K', 'Q', 'J'] as const;
type SymbolId = (typeof SYMBOLS)[number];

/** Gewicht je Symbol und Walze; BOOK und SCARAB sind selten, J am haeufigsten. */
const WEIGHTS: Readonly<Record<SymbolId, number>> = {
  BOOK: 2, SCARAB: 4, ANKH: 6, EYE: 8, URN: 10, A: 14, K: 18, Q: 22, J: 30,
};

/** Auszahlung in Basispunkten des Linieneinsatzes fuer 3 / 4 / 5 Treffer. */
const LINE_PAY: Readonly<Record<SymbolId, readonly [number, number, number]>> = {
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

/** Zehn Linien als Zeilenindex je Walze (0 = oben, 2 = unten). */
const LINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

const SLOT_LINE_COUNT = LINES.length;
/** Skaliert die Paytable; auf 93 % RTP geeicht (siehe Test). */
const PAY_SCALE = 29.6;
const FREE_SPINS = 10;
const MAX_FREE_ROUNDS = 40;

const WEIGHT_TOTAL = SYMBOLS.reduce((sum, symbol) => sum + WEIGHTS[symbol], 0);

function drawSymbol(prng: Prng): SymbolId {
  let roll = prng.nextFloat() * WEIGHT_TOTAL;
  for (const symbol of SYMBOLS) {
    roll -= WEIGHTS[symbol];
    if (roll < 0) return symbol;
  }
  return 'J';
}

function spinReels(prng: Prng): SymbolId[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => drawSymbol(prng)));
}

/** BOOK ist Wild; drei oder mehr BOOK irgendwo starten die Freispiele. */
function lineWin(line: readonly SymbolId[]): number {
  const lead = line.find((symbol) => symbol !== 'BOOK') ?? 'BOOK';
  let run = 0;
  for (const symbol of line) {
    if (symbol === lead || symbol === 'BOOK') run += 1;
    else break;
  }
  if (run < 3) return 0;
  const pay = LINE_PAY[lead];
  return Math.round(pay[run - 3]! * PAY_SCALE);
}

function evaluate(reels: readonly (readonly SymbolId[])[]): number {
  let total = 0;
  for (const line of LINES) {
    const symbols = line.map((row, reel) => reels[reel]![row]!);
    total += lineWin(symbols);
  }
  return total;
}

function countBooks(reels: readonly (readonly SymbolId[])[]): number {
  let books = 0;
  for (const reel of reels) for (const symbol of reel) if (symbol === 'BOOK') books += 1;
  return books;
}

/**
 * Eine Runde inklusive Freispielen. `multiplierBps` bezieht sich auf den
 * Gesamteinsatz (alle Linien), nicht auf eine einzelne Linie.
 */
export function playSlot(prng: Prng): SlotOutcome {
  const reels = spinReels(prng);
  const lineBps = evaluate(reels);
  let freeSpins = countBooks(reels) >= 3 ? FREE_SPINS : 0;
  let rounds = 0;
  let freeBps = 0;
  while (freeSpins > 0 && rounds < MAX_FREE_ROUNDS) {
    freeSpins -= 1;
    rounds += 1;
    const extra = spinReels(prng);
    freeBps += evaluate(extra);
    if (countBooks(extra) >= 3) freeSpins += FREE_SPINS;
  }
  // Je Linie gewonnen, aber auf den Gesamteinsatz normiert.
  const multiplierBps = Math.round((lineBps + freeBps) / SLOT_LINE_COUNT);
  const label = multiplierBps === 0
    ? 'Niete'
    : `${rounds > 0 ? `Freispiele (${rounds}) ` : ''}${(multiplierBps / 10_000).toFixed(2)}x`;
  return {
    multiplierBps,
    label: label.replace('.', ','),
    detail: [reels.map((reel) => reel[1]!).join(' | ')],
  };
}
