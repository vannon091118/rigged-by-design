/** Book-of-VaCoin: drei bis fuenf Walzen, gewichtete Symbole, Freispiele. */
import type { Prng } from '../../rng/prng';
import {
  clampedReels, drawSymbol, FREE_SPINS, lineWin, slotPaylines, SLOT_ROWS, type SlotSymbol, type SlotWeights,
} from './slot-paytable';
import { payScaleFor } from './slot-odds';
import { DEFAULT_SLOT_PROFILE, normalizeSlotProfile, type SlotProfile } from '../slot-profile';

export { SLOT_LINES, SLOT_SYMBOLS } from './slot-paytable';
export { slotJackpotInterval } from './slot-odds';

export interface SlotLineWin {
  /** Index in den Gewinnlinien dieses Geraets. */
  readonly line: number;
  readonly symbol: string;
  readonly count: number;
  readonly bps: number;
}

interface SlotOutcome {
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  readonly symbols: readonly string[];
  readonly jackpot: boolean;
  /** Vollstaendiges Gitter fuer die Anzeige: `grid[walze][reihe]`. */
  readonly grid: readonly (readonly string[])[];
  readonly wins: readonly SlotLineWin[];
  readonly books: number;
}

interface SlotOptions {
  readonly offset?: number;
  readonly forceWin?: boolean;
  /** Walzenanzahl des Geraets; ohne Angabe gelten fuenf. */
  readonly reels?: number;
  /** Gewichte, Auszahlungsprofil und Regeln des Geraets. */
  readonly profile?: SlotProfile;
}

/** Entladung nach Drucklader: 1,48x auf den Gesamteinsatz, unabhaengig von der Paytable. */
const FORCED_WIN_BPS = 14_800;
const MAX_FREE_ROUNDS = 40;

function spinReels(prng: Prng, reels: number, weights: SlotWeights): SlotSymbol[][] {
  return Array.from({ length: reels }, () => Array.from({ length: SLOT_ROWS }, () => drawSymbol(prng, weights)));
}

function shiftReels(reels: SlotSymbol[][], offset: number): SlotSymbol[][] {
  const shift = ((offset % SLOT_ROWS) + SLOT_ROWS) % SLOT_ROWS;
  if (shift === 0) return reels;
  return reels.map((reel) => Array.from({ length: SLOT_ROWS }, (_, row) => reel[(row + shift) % SLOT_ROWS]!));
}

/**
 * Setzt eine echte 3er-SCARAB-Linie auf Linie 0 und gibt sie zurueck: Diese Linie zahlt
 * als Entladung den festen Satz, nicht die Paytable (sonst waere sie zehnmal zu gross).
 */
function forceNonLdw(reels: SlotSymbol[][]): number {
  for (let reel = 0; reel < reels.length; reel += 1) reels[reel]![1] = reel < 3 ? 'SCARAB' : 'J';
  return 0;
}

function countBooks(reels: readonly (readonly SlotSymbol[])[]): number {
  let books = 0;
  for (const reel of reels) for (const symbol of reel) if (symbol === 'BOOK') books += 1;
  return books;
}

function evaluate(
  reels: readonly (readonly SlotSymbol[])[],
  lines: readonly (readonly number[])[],
  scale: number,
  wild: boolean,
): { total: number; wins: SlotLineWin[] } {
  let total = 0;
  const wins: SlotLineWin[] = [];
  lines.forEach((line, index) => {
    const symbols = line.map((row, reel) => reels[reel]![row]!);
    const hit = lineWin(symbols, scale, wild);
    if (!hit) return;
    total += hit.bps;
    wins.push({ line: index, symbol: hit.symbol, count: hit.count, bps: hit.bps });
  });
  return { total, wins };
}

/**
 * Eine Runde inklusive Freispielen. `multiplierBps` bezieht sich auf den
 * Gesamteinsatz (alle Linien), nicht auf eine einzelne Linie. Walzenanzahl,
 * Linien und Skalierung kommen alle aus derselben Konfiguration, deshalb bleibt
 * die Quote ueber alle Geraetegroessen gleich – bis der Betreiber sie veraendert.
 */
export function playSlot(prng: Prng, options: SlotOptions = {}): SlotOutcome {
  const profile = normalizeSlotProfile(options.profile ?? DEFAULT_SLOT_PROFILE);
  const reelCount = clampedReels(options.reels ?? 5);
  const lines = slotPaylines(reelCount);
  const scale = payScaleFor(reelCount, profile.weights, profile.payScaleBps);
  const wild = profile.rules.wildBooks;
  const reels = shiftReels(spinReels(prng, reelCount, profile.weights), options.offset ?? 0);
  const forcedLine = options.forceWin ? forceNonLdw(reels) : -1;
  const { total: lineBps, wins } = evaluate(reels, lines, scale, wild);

  const books = countBooks(reels);
  let freeSpins = profile.rules.freeSpins && books >= 3 ? FREE_SPINS : 0;
  let rounds = 0;
  let freeBps = 0;
  while (freeSpins > 0 && rounds < MAX_FREE_ROUNDS) {
    freeSpins -= 1;
    rounds += 1;
    const extra = spinReels(prng, reelCount, profile.weights);
    freeBps += evaluate(extra, lines, scale, wild).total;
    if (countBooks(extra) >= 3) freeSpins += FREE_SPINS;
  }
  // Je Linie gewonnen, aber auf den Gesamteinsatz normiert.
  // Die Entladung zahlt ihren festen Satz, nicht die Paytable der erzwungenen Linie.
  const multiplierBps = forcedLine < 0
    ? Math.round((lineBps + freeBps) / lines.length)
    : FORCED_WIN_BPS;
  const label = multiplierBps === 0
    ? 'Niete'
    : `${rounds > 0 ? `Freispiele (${rounds}) ` : ''}${(multiplierBps / 10_000).toFixed(2)}x`;
  const center = reels.map((reel) => reel[1]!);
  return {
    multiplierBps,
    label: label.replace('.', ','),
    detail: [center.join(' | ')],
    symbols: center,
    jackpot: profile.rules.freeSpins && books >= 3,
    grid: reels,
    wins,
    books,
  };
}
