/** Book-of-VaCoin: 5x3-Walzen, zehn Gewinnlinien, gewichtete Symbole, Freispiele. */
import type { Prng } from '../../rng/prng';

interface SlotOutcome {
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  readonly symbols: readonly string[];
  readonly jackpot: boolean;
}

interface SlotOptions {
  readonly offset?: number;
  readonly forceWin?: boolean;
  readonly lowWinBias?: boolean;
}

export const SLOT_SYMBOLS = ['BOOK', 'SCARAB', 'ANKH', 'EYE', 'URN', 'A', 'K', 'Q', 'J'] as const;
type SymbolId = (typeof SLOT_SYMBOLS)[number];

/** Gewicht je Symbol und Walze; BOOK und SCARAB sind selten, J am haeufigsten. */
const WEIGHTS: Readonly<Record<SymbolId, number>> = {
  BOOK: 2, SCARAB: 4, ANKH: 6, EYE: 8, URN: 10, A: 14, K: 18, Q: 22, J: 30,
};
/** Bei Drucklevel 3 werden die kleinen Bilder etwas wahrscheinlicher. */
const LOW_WEIGHTS: Readonly<Record<SymbolId, number>> = {
  ...WEIGHTS, A: 18, K: 24, Q: 32, J: 44,
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
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
];

const SLOT_LINE_COUNT = LINES.length;
/** Skaliert die Paytable; auf 93 % RTP geeicht (siehe Test). */
const PAY_SCALE = 29.6;
const FREE_SPINS = 10;
const MAX_FREE_ROUNDS = 40;
const WEIGHT_TOTAL = SLOT_SYMBOLS.reduce((sum, symbol) => sum + WEIGHTS[symbol], 0);
const LOW_WEIGHT_TOTAL = SLOT_SYMBOLS.reduce((sum, symbol) => sum + LOW_WEIGHTS[symbol], 0);

/** 3+ BOOKs sind der Top-Treffer; der Erwartungswert kommt aus der Walzenmathematik. */
function jackpotProbability(): number {
  const p = WEIGHTS.BOOK / WEIGHT_TOTAL;
  const q = 1 - p;
  return 1 - q ** 15 - 15 * p * q ** 14 - 105 * p * p * q ** 13;
}
export const SLOT_JACKPOT_INTERVAL = Math.round(1 / jackpotProbability());

function drawSymbol(prng: Prng, weights: Readonly<Record<SymbolId, number>>, total: number): SymbolId {
  let roll = prng.nextFloat() * total;
  for (const symbol of SLOT_SYMBOLS) {
    roll -= weights[symbol];
    if (roll < 0) return symbol;
  }
  return 'J';
}

function spinReels(prng: Prng, lowWinBias = false): SymbolId[][] {
  const weights = lowWinBias ? LOW_WEIGHTS : WEIGHTS;
  const total = lowWinBias ? LOW_WEIGHT_TOTAL : WEIGHT_TOTAL;
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => drawSymbol(prng, weights, total)));
}

function shiftReels(reels: SymbolId[][], offset: number): SymbolId[][] {
  const shift = ((offset % 3) + 3) % 3;
  if (shift === 0) return reels;
  return reels.map((reel) => Array.from({ length: 3 }, (_, row) => reel[(row + shift) % 3]!));
}

/** Setzt eine echte 3er-SCARAB-Linie; 1,48x liegt sicher ueber dem Standardeinsatz. */
function forceNonLdw(reels: SymbolId[][]): void {
  for (let reel = 0; reel < 5; reel += 1) reels[reel]![1] = reel < 3 ? 'SCARAB' : 'J';
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
export function playSlot(prng: Prng, options: SlotOptions = {}): SlotOutcome {
  const reels = shiftReels(spinReels(prng, options.lowWinBias), options.offset ?? 0);
  if (options.forceWin) forceNonLdw(reels);
  const lineBps = evaluate(reels);
  const books = countBooks(reels);
  let freeSpins = books >= 3 ? FREE_SPINS : 0;
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
  const center = reels.map((reel) => reel[1]!);
  return {
    multiplierBps,
    label: label.replace('.', ','),
    detail: [center.join(' | ')],
    symbols: center,
    jackpot: books >= 3,
  };
}
