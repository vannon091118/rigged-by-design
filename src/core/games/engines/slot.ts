/** Book-of-VaCoin: drei bis fuenf Walzen, Streifen oder Gewichte, drei Bewertungsmodelle. */
import type { Prng } from '../../rng/prng';
import { drawSymbol, type SlotSymbol } from './slot-paytable';
import { assertSlotConfig, slotConfig, type SlotConfig } from '../slot-config';
import { payScaleFor } from './slot-odds';
import { evaluateGrid, type ModelContext, type ModelWin } from './slot-models';
import type { SlotProfile } from '../slot-profile';

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
  /** Bonusspiel-Zustand: Runden, Multiplikator und Ertrag der Freispiele. */
  readonly bonus?: { readonly rounds: number; readonly multiplier: number; readonly bps: number };
}

interface SlotOptions {
  readonly offset?: number;
  readonly forceWin?: boolean;
  /** Walzenanzahl des Geraets; ohne Angabe gelten fuenf. */
  readonly reels?: number;
  /** Walzenstreifen, Gewichte, Modell und Regeln des Geraets. */
  readonly profile?: SlotProfile;
  /** Die Konfiguration des Geräts; sie ersetzt die Einzelparameter. */
  readonly config?: SlotConfig;
}

/** Entladung nach Drucklader: 1,48x auf den Gesamteinsatz, unabhaengig von der Paytable. */
const FORCED_WIN_BPS = 14_800;
const MAX_FREE_ROUNDS = 40;

/** Ziehung aus dem Streifen: gleichverteilt ueber die eingetragene Symbolfolge. */
function drawFromStrip(prng: Prng, strip: readonly SlotSymbol[]): SlotSymbol {
  return strip[prng.nextInt(0, strip.length - 1)]!;
}

function spinReels(prng: Prng, config: SlotConfig): SlotSymbol[][] {
  const { profile } = config;
  return Array.from({ length: config.reels }, (_, reel) => {
    const strip = profile.reelStrips[reel] ?? profile.reelStrips[profile.reelStrips.length - 1];
    return Array.from({ length: config.rows }, () => (
      strip && strip.length > 0 ? drawFromStrip(prng, strip) : drawSymbol(prng, profile.weights)
    ));
  });
}

function shiftReels(reels: SlotSymbol[][], config: SlotConfig, offset: number): SlotSymbol[][] {
  const { rows } = config;
  const shift = ((offset % rows) + rows) % rows;
  if (shift === 0) return reels;
  return reels.map((reel) => Array.from({ length: rows }, (_, row) => reel[(row + shift) % rows]!));
}

/**
 * Setzt eine echte 3er-SCARAB-Linie auf Linie 0 und gibt sie zurueck: Diese Linie zahlt
 * als Entladung den festen Satz, nicht die Paytable (sonst waere sie zehnmal zu gross).
 */
function forceNonLdw(reels: SlotSymbol[][], rows: number): number {
  const center = Math.floor(rows / 2);
  for (let reel = 0; reel < reels.length; reel += 1) reels[reel]![center] = reel < 3 ? 'SCARAB' : 'J';
  return 0;
}

function countBooks(reels: readonly (readonly SlotSymbol[])[]): number {
  let books = 0;
  for (const reel of reels) for (const symbol of reel) if (symbol === 'BOOK') books += 1;
  return books;
}

/**
 * Eine Runde inklusive Bonusspiel. `multiplierBps` bezieht sich auf den Gesamteinsatz:
 * Linien teilen durch ihre Anzahl, Ways und Cluster zaehlen bereits auf den Gesamteinsatz.
 */
export function playSlot(prng: Prng, options: SlotOptions = {}): SlotOutcome {
  // Die Konfiguration ist die einzige Quelle: fehlt sie, baut die Engine sie
  // aus den Einzelparametern – und weist alles Ungueltige ab.
  const config = options.config ?? slotConfig({ reels: options.reels, profile: options.profile });
  assertSlotConfig(config);
  const profile = config.profile;
  const reelCount = config.reels;
  const lines = config.paylines;
  const wild = profile.wildMode === 'BOOK';
  const scale = payScaleFor(reelCount, profile.weights, {
    model: profile.model, volatility: profile.volatility, payScaleBps: profile.payScaleBps,
  });
  const context: ModelContext = {
    reels: reelCount, rows: config.rows, weights: profile.weights, wild, scale, volatility: profile.volatility,
  };
  const bonusContext: ModelContext = {
    ...context, scale: scale * (profile.bonusPayScaleBps / 10_000),
  };
  const evaluate = (grid: readonly (readonly SlotSymbol[])[], ctx: ModelContext): { total: number; wins: ModelWin[] } =>
    evaluateGrid(profile.model, grid, lines, ctx);

  const reels = shiftReels(spinReels(prng, config), config, options.offset ?? 0);
  const forcedLine = options.forceWin ? forceNonLdw(reels, config.rows) : -1;
  const base = evaluate(reels, context);

  const books = countBooks(reels);
  const triggers = profile.scatter && profile.freeSpins > 0 && books >= 3;
  let freeSpins = triggers ? profile.freeSpins : 0;
  let rounds = 0;
  let bonusBps = 0;
  while (freeSpins > 0 && rounds < MAX_FREE_ROUNDS) {
    freeSpins -= 1;
    rounds += 1;
    const extra = spinReels(prng, config);
    // Die Bonus-Paytable ist eigen: sie skaliert die Gewinne der Freispiele,
    // der Multiplikator kommt obendrauf.
    bonusBps += evaluate(extra, bonusContext).total * profile.multiplier;
    if (profile.scatter && countBooks(extra) >= 3) freeSpins += profile.freeSpins;
  }

  const totalBps = base.total + bonusBps;
  const multiplierBps = forcedLine < 0
    ? Math.round(profile.model === 'LINES' ? totalBps / lines.length : totalBps)
    : FORCED_WIN_BPS;
  const label = multiplierBps === 0
    ? 'Niete'
    : `${rounds > 0 ? `Bonus (${rounds}${profile.multiplier > 1 ? ` ×${profile.multiplier}` : ''}) ` : ''}${(multiplierBps / 10_000).toFixed(2)}x`;
  const center = reels.map((reel) => reel[1]!);
  return {
    multiplierBps,
    label: label.replace('.', ','),
    detail: [center.join(' | ')],
    symbols: center,
    jackpot: triggers,
    grid: reels,
    wins: base.wins.map((win) => ({ ...win })),
    books,
    ...(rounds > 0 ? { bonus: { rounds, multiplier: profile.multiplier, bps: Math.round(bonusBps) } } : {}),
  };
}
