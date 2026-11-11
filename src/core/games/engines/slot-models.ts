/**
 * Die drei Bewertungsmodelle des Slots: Linien, Ways und Cluster.
 *
 * Jedes Modell ist eine eigene Regel, kein Schalter am selben Rechner. Die
 * Erwartungswerte werden geschlossen berechnet und mit denselben Funktionen
 * gebildet, die den Spin auswerten – Anzeige und Mechanik koennen nicht auseinanderlaufen.
 */
import { LINE_PAY, SLOT_ROWS, SLOT_SYMBOLS, weightTotal, type SlotSymbol, type SlotWeights } from './slot-paytable';

export type PayModel = 'LINES' | 'WAYS' | 'CLUSTER'; export type Volatility = 'LOW' | 'MID' | 'HIGH';

const LOW_SYMBOLS: ReadonlySet<SlotSymbol> = new Set(['URN', 'A', 'K', 'Q', 'J']);
const HIGH_SYMBOLS: ReadonlySet<SlotSymbol> = new Set(['BOOK', 'SCARAB', 'ANKH', 'EYE']);

/** Volatilitaet formt die Paytable: flach drueckt grosse Gewinne, steil hebt sie. */
function volatilityFactor(symbol: SlotSymbol, volatility: Volatility): number {
  if (volatility === 'MID') return 1;
  if (LOW_SYMBOLS.has(symbol)) return volatility === 'LOW' ? 1.25 : 0.75;
  if (HIGH_SYMBOLS.has(symbol)) return volatility === 'LOW' ? 0.85 : 1.35;
  return 1;
}

/** Cluster zaehlen gleiche Symbole im ganzen Gitter; Stufen ab fuenf Zellen. */
const CLUSTER_TIERS: readonly (readonly [number, number])[] = [
  [15, 2_500_000], [12, 500_000], [9, 100_000], [7, 30_000], [5, 10_000],
];

export interface ModelContext { readonly reels: number; readonly rows: number; readonly weights: SlotWeights; readonly wild: boolean; readonly scale: number; readonly volatility: Volatility; }

export interface ModelWin { readonly line: number; readonly symbol: string; readonly count: number; readonly bps: number; }

export function payBps(symbol: SlotSymbol, count: number, scale: number, volatility: Volatility): number {
  const pay = LINE_PAY[symbol][Math.min(2, Math.max(0, count - 3))]!;
  return Math.round(pay * scale * volatilityFactor(symbol, volatility));
}

/** Klassisch: links beginnen, Wild ersetzt, erster Fremdsymbol beendet den Lauf. */
export function evaluateLines(
  grid: readonly (readonly SlotSymbol[])[], lines: readonly (readonly number[])[], ctx: ModelContext,
): { total: number; wins: ModelWin[] } {
  let total = 0; const wins: ModelWin[] = [];
  lines.forEach((line, index) => {
    const symbols = line.map((row, reel) => grid[reel]![row]!);
    const lead = symbols.find((symbol) => symbol !== 'BOOK') ?? 'BOOK';
    let run = 0;
    while (run < symbols.length && (symbols[run] === lead || (ctx.wild && symbols[run] === 'BOOK'))) run += 1;
    if (run < 3) return;
    const bps = payBps(lead, run, ctx.scale, ctx.volatility);
    total += bps;
    wins.push({ line: index, symbol: lead, count: run, bps });
  });
  return { total, wins };
}

function matches(cell: SlotSymbol, symbol: SlotSymbol, wild: boolean): boolean {
  return cell === symbol || (wild && cell === 'BOOK' && symbol !== 'BOOK');
}

/** Ways: jede Walze mit mindestens einem Treffer zaehlt, die Anzahl der Wege multipliziert. */
export function evaluateWays(
  grid: readonly (readonly SlotSymbol[])[], ctx: ModelContext,
): { total: number; wins: ModelWin[] } {
  let total = 0; const wins: ModelWin[] = [];
  for (const symbol of SLOT_SYMBOLS) {
    let run = 0; let ways = 1;
    for (const reel of grid) {
      const hits = reel.filter((cell) => matches(cell, symbol, ctx.wild)).length;
      if (hits === 0) break;
      ways *= hits;
      run += 1;
    }
    if (run >= 3) {
      const bps = payBps(symbol, run, ctx.scale, ctx.volatility) * ways;
      total += bps;
      wins.push({ line: wins.length, symbol, count: run, bps });
    }
  }
  return { total, wins };
}

/** Cluster: gleiche Symbole irgendwo im Gitter, beste Stufe zahlt einmal. */
export function evaluateCluster(
  grid: readonly (readonly SlotSymbol[])[], ctx: ModelContext,
): { total: number; wins: ModelWin[] } {
  const cells = grid.flat();
  let best: { symbol: SlotSymbol; count: number; bps: number } | null = null;
  for (const symbol of SLOT_SYMBOLS) {
    const count = cells.filter((cell) => matches(cell, symbol, ctx.wild)).length;
    const tier = CLUSTER_TIERS.find(([need]) => count >= need);
    if (!tier) continue;
    const bps = Math.round(tier[1] * ctx.scale * volatilityFactor(symbol, ctx.volatility));
    if (!best || bps > best.bps) best = { symbol, count, bps };
  }
  return best
    ? { total: best.bps, wins: [{ line: 0, symbol: best.symbol, count: best.count, bps: best.bps }] }
    : { total: 0, wins: [] };
}

export function evaluateGrid(
  model: PayModel, grid: readonly (readonly SlotSymbol[])[], lines: readonly (readonly number[])[], ctx: ModelContext,
): { total: number; wins: ModelWin[] } {
  if (model === 'WAYS') return evaluateWays(grid, ctx);
  if (model === 'CLUSTER') return evaluateCluster(grid, ctx);
  return evaluateLines(grid, lines, ctx);
}

function symbolChance(weights: SlotWeights, symbol: SlotSymbol): number {
  const total = weightTotal(weights);
  return total > 0 ? Math.max(0, weights[symbol]) / total : 0;
}

function binom(n: number, k: number): number {
  let value = 1;
  for (let step = 0; step < k; step += 1) value = (value * (n - step)) / (step + 1);
  return value;
}

interface LineStats { readonly expectation: number; readonly hitBps: number; }

/**
 * Exakte Linien-Verteilung: Der erste Nicht-Buch-Treffer ist das führende
 * Symbol. Ein Lauf aus reinen Büchern zahlt BOOK nur, wenn die ganze Linie
 * aus Büchern besteht; ein Buch-Präfix vor einem anderen Symbol gehört zu
 * diesem anderen Symbol, nicht zu jedem möglichen Fremdsymbol.
 */
export function lineStats(
  reels: number, weights: SlotWeights, wild: boolean, volatility: Volatility,
): LineStats {
  const total = weightTotal(weights);
  if (total <= 0 || reels < 3) return { expectation: 0, hitBps: 0 };
  const book = Math.max(0, weights.BOOK) / total;
  let expectation = 0; let hit = 0;
  for (const symbol of SLOT_SYMBOLS) {
    const p = Math.max(0, weights[symbol]) / total;
    const match = wild && symbol !== 'BOOK' ? p + book : p;
    for (let run = 3; run <= reels; run += 1) {
      const prefix = symbol === 'BOOK'
        ? (run === reels ? book ** reels : 0)
        : wild ? match ** run - book ** run : p ** run;
      const probability = prefix * (run === reels ? 1 : 1 - match);
      if (probability <= 0) continue;
      expectation += probability * payBps(symbol, run, 1, volatility);
      hit += probability;
    }
  }
  return { expectation, hitBps: hit * 10_000 };
}

function tail(cells: number, p: number, from: number): number {
  let total = 0;
  for (let count = from; count <= cells; count += 1) {
    total += binom(cells, count) * p ** count * (1 - p) ** (cells - count);
  }
  return total;
}

/**
 * Erwartungswert eines Modells, unskaliert: bei Linien je Linie, bei Ways und
 * Cluster fuer den ganzen Spin. Geschlossen gerechnet, nicht gesampelt.
 */
export function modelExpectation(
  model: PayModel, reels: number, weights: SlotWeights, wild: boolean, volatility: Volatility,
): number {
  if (model === 'LINES') return lineStats(reels, weights, wild, volatility).expectation;
  const rows = SLOT_ROWS;
  if (model === 'WAYS') {
    let total = 0;
    for (const symbol of SLOT_SYMBOLS) {
      const p = symbolChance(weights, symbol) + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0);
      const pAny = 1 - (1 - p) ** rows;
      const mean = (rows * p) / Math.max(1e-9, pAny);
      for (let run = 3; run <= reels; run += 1) {
        total += (run === reels ? pAny ** run : pAny ** run * (1 - pAny))
          * payBps(symbol, run, 1, volatility) * mean ** run;
      }
    }
    return total;
  }
  let total = 0; const cells = reels * rows;
  for (const symbol of SLOT_SYMBOLS) {
    const p = symbolChance(weights, symbol) + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0);
    for (const [need, pay] of CLUSTER_TIERS) {
      const next = CLUSTER_TIERS.find(([higher]) => higher > need);
      const probability = tail(cells, p, need) - (next ? tail(cells, p, next[0]) : 0);
      total += probability * Math.round(pay * volatilityFactor(symbol, volatility));
    }
  }
  return total;
}
