/**
 * Europaeisches Roulette-Tableau: mehrere Jetons gleichzeitig, eine Kugel.
 * Die Auszahlung je Feld steht hier, damit Anzeige und Kern dieselbe Quelle lesen.
 */
import { mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';

/** Kesselreihenfolge des europaeischen Rads, im Uhrzeigersinn ab der Null. */
export const ROULETTE_WHEEL: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/** Die roten Zahlen des Tableaus; alles andere ausser 0 ist schwarz. */
const ROULETTE_RED: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const colourOf = (number: number): string =>
  number === 0 ? 'gruen' : ROULETTE_RED.has(number) ? 'rot' : 'schwarz';

type RouletteSpotKind = 'STRAIGHT' | 'DOZEN' | 'COLUMN' | 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'LOW' | 'HIGH';

interface SpotInfo {
  readonly kind: RouletteSpotKind;
  readonly bps: number;
  readonly label: string;
}

const EVEN_ODDS: readonly (readonly [string, string])[] = [
  ['RED', 'ROT'], ['BLACK', 'SCHWARZ'], ['EVEN', 'GERADE'], ['ODD', 'UNGERADE'],
  ['LOW', '1-18'], ['HIGH', '19-36'],
];

/** Feld-Kennung -> Beschriftung und Auszahlung. "N17" ist die 17, "D2" das zweite Dutzend. */
export function spotInfo(spot: string): SpotInfo | null {
  if (spot.startsWith('N')) {
    const number = Number(spot.slice(1));
    if (!Number.isInteger(number) || number < 0 || number > 36) return null;
    return { kind: 'STRAIGHT', bps: 360_000, label: String(number) };
  }
  const head = spot.charAt(0);
  const index = Number(spot.slice(1));
  if (head === 'D' && index >= 1 && index <= 3) {
    return { kind: 'DOZEN', bps: 30_000, label: `${index}. Dutzend` };
  }
  if (head === 'C' && index >= 1 && index <= 3) {
    return { kind: 'COLUMN', bps: 30_000, label: `${index}. Kolonne` };
  }
  const even = EVEN_ODDS.find(([id]) => id === spot);
  return even ? { kind: spot as RouletteSpotKind, bps: 19_500, label: even[1]! } : null;
}

/** Deckt ein Feld diese Zahl? Reihenfolge und Grenzen wie auf dem gedruckten Teppich. */
export function spotCovers(spot: string, number: number): boolean {
  if (spot.startsWith('N')) return Number(spot.slice(1)) === number;
  switch (spot) {
    case 'D1': return number >= 1 && number <= 12;
    case 'D2': return number >= 13 && number <= 24;
    case 'D3': return number >= 25 && number <= 36;
    // Kolonne 1 ist 1, 4, 7 ... - die Restklassen des Tableaus.
    case 'C1': return number > 0 && number % 3 === 1;
    case 'C2': return number > 0 && number % 3 === 2;
    case 'C3': return number > 0 && number % 3 === 0;
    case 'RED': return ROULETTE_RED.has(number);
    case 'BLACK': return number > 0 && !ROULETTE_RED.has(number);
    case 'EVEN': return number > 0 && number % 2 === 0;
    case 'ODD': return number > 0 && number % 2 === 1;
    case 'LOW': return number >= 1 && number <= 18;
    case 'HIGH': return number >= 19 && number <= 36;
    default: return false;
  }
}

export interface RouletteChip {
  readonly spot: string;
  readonly stake: VaCoinMicro;
}

interface RouletteHit {
  readonly spot: string;
  readonly stake: VaCoinMicro;
  readonly bps: number;
  readonly payout: VaCoinMicro;
}

export interface RouletteSpin {
  readonly number: number;
  readonly colour: string;
  readonly hits: readonly RouletteHit[];
  /** Netto-Quote des gesamten Satzes; 0 heisst Niete. */
  readonly multiplierBps: number;
  readonly payout: VaCoinMicro;
}

export function totalStake(chips: readonly RouletteChip[]): VaCoinMicro {
  let sum = 0;
  for (const chip of chips) sum += chip.stake;
  return sum as VaCoinMicro;
}

/**
 * Eine Kugel, viele Jetons: jede deckende Wette zahlt ihre eigene Quote.
 * Die Gesamtquote ist der gewichtete Anteil am gesamten Satz.
 */
export function spinRouletteTable(prng: Prng, chips: readonly RouletteChip[]): RouletteSpin {
  const stake = totalStake(chips);
  if (stake <= 0) throw new Error('Roulette: ohne Jeton dreht sich nichts.');
  const number = prng.nextInt(0, 36);
  const hits: RouletteHit[] = [];
  let won = 0;
  for (const chip of chips) {
    if (chip.stake <= 0 || !spotCovers(chip.spot, number)) continue;
    const info = spotInfo(chip.spot);
    if (!info) continue;
    const payout = mulVC(chip.stake, info.bps);
    won += payout;
    hits.push({ spot: chip.spot, stake: chip.stake, bps: info.bps, payout });
  }
  const multiplierBps = won > 0 ? Math.round((won / stake) * 10_000) : 0;
  return {
    number,
    colour: colourOf(number),
    hits,
    multiplierBps,
    payout: won > 0 ? mulVC(stake, multiplierBps) : ZERO_VC,
  };
}
