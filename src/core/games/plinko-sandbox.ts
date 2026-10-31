/** Plinko-Sandbox: RTP-Gate, Fortschritt und der Wurf, der Weltzustand und Anzeige verbindet. */
import { mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import type { WorldState } from '../sim/types';
import type { GameResult } from './contracts';
import { createPlinkoBoard } from './plinko-board';
import {
  normalizePlinkoConfig, plinkoPaytable, plinkoProgress, pocketPayout,
  PLINKO_BASE_ROWS, PLINKO_MAX_ROWS,
  type PlinkoConfig, type PlinkoDrop, type PlinkoMode,
} from './plinko-config';

export interface GateResult {
  readonly ok: boolean;
  readonly measuredRtp: number;
  readonly reason: string;
  /** 95-%-Konfidenzintervall des gemessenen RTP. */
  readonly ciLow: number;
  readonly ciHigh: number;
  /** Wuerfe insgesamt und Anzahl unhaengiger Seeds. */
  readonly samples: number;
  readonly seeds: number;
}

/** Unabhaengige Seeds: ein einziger Waere eine Stichprobe, die mit Glueck besteht. */
const GATE_SEEDS: readonly number[] = [0x51ca5e, 0x2bb1c3, 0x7f19d4, 0x4ad0e2, 0x9c33b7];
const DROPS_PER_SEED = 600;
/** Zwei-seitiges 95-%-Intervall. */
const Z_95 = 1.96;
/** Erst wenn die Stichprobe eng genug ist, darf sie ueber das Hausband entscheiden. */
const MAX_STANDARD_ERROR = 0.03;
const RTP_MIN = 0.85;
const RTP_MAX = 0.96;
const BAND_TEXT = 'Hausband 85–96 %';

/**
 * Deterministische Physik-Stichprobe; das Gate blockiert vor jedem Deployment.
 *
 * Mehrere unabhaengige Seeds werden zusammengezogen: der Wert, der entscheidet,
 * ist der Mittelwert aller Wuerfe, das Konfidenzintervall sagt, wie sicher der
 * Wert ist, und Taschen, die zahlen aber nie getroffen werden, gelten als nicht
 * abgesichert – nicht als null.
 */
export function deployGate(config: PlinkoConfig, rows = PLINKO_BASE_ROWS): GateResult {
  const safe = normalizePlinkoConfig(config);
  const table = plinkoPaytable(safe.pocketCount);
  // Struktur zuerst: eine Paytable, die nicht zur Taschenzahl passt, rettet keine Stichprobe.
  const problems: string[] = [];
  if (table.length !== safe.pocketCount) {
    problems.push(`Paytable hat ${table.length} Eintraege fuer ${safe.pocketCount} Taschen.`);
  }
  if (table.some((value) => !Number.isFinite(value) || value < 0)) {
    problems.push('Paytable enthaelt ungueltige Auszahlungen.');
  }
  if (!Number.isInteger(rows) || rows < PLINKO_BASE_ROWS || rows > PLINKO_MAX_ROWS) {
    problems.push(`Reihen ${String(rows)} liegen ausserhalb ${PLINKO_BASE_ROWS}–${PLINKO_MAX_ROWS}.`);
  }

  const board = createPlinkoBoard(safe, rows);
  const hits = new Array<number>(safe.pocketCount).fill(0);
  let samples = 0;
  let sum = 0;
  let sumSq = 0;
  for (const seed of GATE_SEEDS) {
    const prng = new Prng(seed);
    for (let drop = 0; drop < DROPS_PER_SEED; drop += 1) {
      const result = board.drop(prng, 'SINGLE', false);
      let returned = 0;
      for (const pocket of result.pockets) {
        returned += table[pocket] ?? 0;
        hits[pocket] = (hits[pocket] ?? 0) + 1;
      }
      const value = returned / 10_000;
      sum += value;
      sumSq += value * value;
      samples += 1;
    }
  }
  const measuredRtp = samples > 0 ? sum / samples : 0;
  const variance = samples > 1 ? Math.max(0, (sumSq - (sum * sum) / samples) / (samples - 1)) : 0;
  const standardError = samples > 0 ? Math.sqrt(variance / samples) : 0;
  const ciLow = measuredRtp - Z_95 * standardError;
  const ciHigh = measuredRtp + Z_95 * standardError;
  const evidence = `RTP ${(measuredRtp * 100).toFixed(1)} % (95 %-KI ${(ciLow * 100).toFixed(1)}–${(ciHigh * 100).toFixed(1)} %) aus ${samples} Wuerfen bei ${GATE_SEEDS.length} Seeds`;

  if (standardError > MAX_STANDARD_ERROR) {
    problems.push(`Stichprobe zu unsicher: Standardfehler ${(standardError * 100).toFixed(1)} Punkte.`);
  }
  const unreachable = table
    .map((value, index) => ((value > 0 && (hits[index] ?? 0) === 0) ? index + 1 : 0))
    .filter((pocket) => pocket > 0);
  if (unreachable.length > 0) {
    problems.push(`Taschen ${unreachable.join(', ')} zahlen, wurden aber in ${samples} Wuerfen nie erreicht.`);
  }
  if (measuredRtp < RTP_MIN || measuredRtp > RTP_MAX) {
    problems.push(`RTP ${(measuredRtp * 100).toFixed(1)} % liegt ausserhalb des ${BAND_TEXT}.`);
  }
  const ok = problems.length === 0;
  const reason = ok
    ? `${evidence} liegt im ${BAND_TEXT}.`
    : `${evidence}: ${problems.join(' ')}`;
  return {
    ok, measuredRtp, reason, ciLow, ciHigh, samples, seeds: GATE_SEEDS.length,
  };
}

/**
 * Liest den Freischrittstand und wirft: reine Funktion, die keinen Zaehler
 * des Weltzustands anfasst. Beide Pfade – echter Wurf und Test – teilen ihn.
 */
function sandboxDrop(state: WorldState, prng: Prng, mode: PlinkoMode): PlinkoDrop {
  const progress = plinkoProgress(state.totalPlinkoDrops, state.addictionScore, state.plinko);
  if (mode !== 'SINGLE' && progress.rows < (mode === 'TWIN' ? 9 : 12)) {
    throw new Error(`${mode} ist noch nicht freigeschaltet.`);
  }
  const board = createPlinkoBoard(state.plinko, progress.rows);
  return board.drop(prng, mode, true);
}

/** Aus Wurf und Einsatz wird das eine Ergebnis, das beide Pfade anzeigen. */
function plinkoResult(stake: VaCoinMicro, drop: PlinkoDrop, table: PlinkoConfig, bonusBps: number): GameResult {
  const base = drop.pockets.reduce((sum, pocket) => sum + pocketPayout(table, pocket), 0);
  const multiplierBps = base > 0 ? Math.max(0, base + bonusBps) : 0;
  return {
    game: 'PLINKO',
    stake,
    payout: mulVC(stake, multiplierBps),
    multiplierBps,
    label: `${drop.pockets.length} ${drop.pockets.length === 1 ? 'Ball' : 'Bälle'} · ${drop.pockets.map((pocket) => pocket + 1).join(' + ')}`,
    detail: drop.pockets.map((pocket, index) => `● ${index + 1}: ${pocket + 1}`),
  };
}

/** Ein echter Sandbox-Wurf: Fortschritt zaehlt jeden Drop, auch ohne Gewinn. */
function spinPlinkoSandbox(state: WorldState, prng: Prng, mode: PlinkoMode): PlinkoDrop {
  const drop = sandboxDrop(state, prng, mode);
  state.totalPlinkoDrops += 1;
  state.addictionScore = Math.min(100, state.addictionScore + 0.6);
  state.lastPlinko = drop;
  return drop;
}

/** Ein Wurf aus Sicht des Spiels: Mehrball-Taschen addieren sich, Bonus nur auf Gewinne. */
export function playPlinkoRound(
  world: WorldState,
  prng: Prng,
  stake: VaCoinMicro,
  bonusBps = 0,
): GameResult {
  const drop = spinPlinkoSandbox(world, prng, world.plinkoMode);
  return plinkoResult(stake, drop, world.plinko, bonusBps);
}

/**
 * Der kostenlose Testwurf: dieselbe Bahn zur selben Freischaltstufe, aber mit
 * eigenem Zufall aus Tick und Geraet. Er zaehlt weder Drops noch Sucht und
 * laesst `lastPlinko` unberuehrt – die Vorschau veraendert nicht das Spiel.
 */
export function playPlinkoTest(world: WorldState, prng: Prng): GameResult {
  return plinkoResult(ZERO_VC, sandboxDrop(world, prng, world.plinkoMode), world.plinko, 0);
}
