/**
 * Die drei Bewertungsmodelle des Slots: Linien, Ways und Cluster.
 *
 * Jedes Modell ist eine eigene Regel, kein Schalter am selben Rechner. Die
 * Erwartungswerte werden geschlossen berechnet und mit denselben Funktionen
 * gebildet, die den Spin auswerten – Anzeige und Mechanik koennen nicht auseinanderlaufen.
 */
import { LINE_PAY, SLOT_ROWS, SLOT_SYMBOLS, weightTotal, type SlotSymbol, type SlotWeights } from './slot-paytable';

export type PayModel = 'LINES' | 'WAYS' | 'CLUSTER';
export type Volatility = 'LOW' | 'MID' | 'HIGH';

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

export interface ModelContext {
  readonly reels: number;
  readonly rows: number;
  readonly weights: SlotWeights;
  readonly wild: boolean;
  readonly scale: number;
  readonly volatility: Volatility;
}

export interface ModelWin {
  readonly line: number;
  readonly symbol: string;
  readonly count: number;
  readonly bps: number;
}

export function payBps(symbol: SlotSymbol, count: number, scale: number, volatility: Volatility): number {
  const pay = LINE_PAY[symbol][Math.min(2, Math.max(0, count - 3))]!;
  return Math.round(pay * scale * volatilityFactor(symbol, volatility));
}

/** Klassisch: links beginnen, Wild ersetzt, erster Fremdsymbol beendet den Lauf. */
export function evaluateLines(
  grid: readonly (readonly SlotSymbol[])[], lines: readonly (readonly number[])[], ctx: ModelContext,
): { total: number; wins: ModelWin[] } {
  let total = 0;
  const wins: ModelWin[] = [];
  lines.forEach((line, index) => {
    const symbols = line.map((row, reel) => grid[reel]![row]!);
    const lead = symbols.find((symbol) => symbol !== 'BOOK') ?? 'BOOK';
    let run = 0;
    for (const symbol of symbols) {
      if (symbol === lead || (ctx.wild && symbol === 'BOOK')) run += 1;
      else break;
    }
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
  let total = 0;
  const wins: ModelWin[] = [];
  for (const symbol of SLOT_SYMBOLS) {
    let run = 0;
    let ways = 1;
    for (const reel of grid) {
      const hits = reel.filter((cell) => matches(cell, symbol, ctx.wild)).length;
      if (hits === 0) break;
      ways *= hits;
      run += 1;
    }
    if (run < 3) continue;
    const bps = payBps(symbol, run, ctx.scale, ctx.volatility) * ways;
    total += bps;
    wins.push({ line: wins.length, symbol, count: run, bps });
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

/**
 * Erwartungswert eines Modells, unskaliert: bei Linien je Linie, bei Ways und
 * Cluster fuer den ganzen Spin. Geschlossen gerechnet, nicht gesampelt.
 */
export function modelExpectation(
  model: PayModel, reels: number, weights: SlotWeights, wild: boolean, volatility: Volatility,
): number {
  const rows = SLOT_ROWS;
  if (model === 'LINES') {
    let best = 0;
    for (const symbol of SLOT_SYMBOLS) {
      let ev = 0;
      for (let run = 3; run <= reels; run += 1) {
        let probability = 1;
        for (let reel = 0; reel < run; reel += 1) {
          probability *= symbolChance(weights, symbol)
            + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0);
        }
        if (run < reels) {
          probability *= 1 - (symbolChance(weights, symbol)
            + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0));
        }
        ev += probability * payBps(symbol, run, 1, volatility);
      }
      best += ev;
    }
    return best;
  }
  if (model === 'WAYS') {
    let total = 0;
    for (const symbol of SLOT_SYMBOLS) {
      const p = symbolChance(weights, symbol) + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0);
      const pAny = 1 - (1 - p) ** rows;
      const meanWays = (rows * p) / Math.max(1e-9, pAny);
      for (let run = 3; run <= reels; run += 1) {
        const exact = run === reels ? pAny ** run : pAny ** run * (1 - pAny);
        total += exact * payBps(symbol, run, 1, volatility) * meanWays ** run;
      }
    }
    return total;
  }
  let total = 0;
  const cells = reels * rows;
  for (const symbol of SLOT_SYMBOLS) {
    const p = symbolChance(weights, symbol) + (wild && symbol !== 'BOOK' ? symbolChance(weights, 'BOOK') : 0);
    for (const [need, pay] of CLUSTER_TIERS) {
      // Genau diese Stufe: mindestens `need` Zellen, aber nicht die naechste Stufe.
      let atLeast = 0;
      for (let count = need; count <= cells; count += 1) {
        atLeast += binom(cells, count) * p ** count * (1 - p) ** (cells - count);
      }
      const next = CLUSTER_TIERS.find(([higher]) => higher > need);
      let above = 0;
      if (next) for (let count = next[0]; count <= cells; count += 1) {
        above += binom(cells, count) * p ** count * (1 - p) ** (cells - count);
      }
      total += (atLeast - above) * Math.round(pay * volatilityFactor(symbol, volatility));
    }
  }
  return total;
}
