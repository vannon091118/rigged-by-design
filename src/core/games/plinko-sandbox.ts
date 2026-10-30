/** Plinko-Sandbox: RTP-Gate, Fortschritt und der Wurf, der Weltzustand und Anzeige verbindet. */
import { mulVC, type VaCoinMicro } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import type { WorldState } from '../sim/types';
import type { GameResult } from './contracts';
import { createPlinkoBoard } from './plinko-board';
import {
  normalizePlinkoConfig, plinkoPaytable, plinkoProgress, pocketPayout,
  type PlinkoConfig, type PlinkoDrop, type PlinkoMode,
} from './plinko-config';

export interface GateResult {
  readonly ok: boolean;
  readonly measuredRtp: number;
  readonly reason: string;
}

/** Deterministische Physik-Stichprobe; das Gate blockiert vor jedem Deployment. */
export function deployGate(config: PlinkoConfig, rows = 8): GateResult {
  const safe = normalizePlinkoConfig(config);
  const table = plinkoPaytable(safe.pocketCount);
  const board = createPlinkoBoard(safe, rows);
  const prng = new Prng(0x51ca5e);
  const samples = 600;
  let returned = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const drop = board.drop(prng, 'SINGLE', false);
    for (const pocket of drop.pockets) returned += table[pocket] ?? 0;
  }
  const measuredRtp = returned / samples / 10_000;
  const ok = measuredRtp >= 0.85 && measuredRtp <= 0.96;
  const reason = ok
    ? `RTP ${(measuredRtp * 100).toFixed(1)} % liegt im Hausband 85–96 %.`
    : `RTP ${(measuredRtp * 100).toFixed(1)} % liegt ausserhalb des Hausbands 85–96 %.`;
  return { ok, measuredRtp, reason };
}

/** Ein echter Sandbox-Wurf: Fortschritt zaehlt jeden Drop, auch ohne Gewinn. */
function spinPlinkoSandbox(state: WorldState, prng: Prng, mode: PlinkoMode): PlinkoDrop {
  const progress = plinkoProgress(state.totalPlinkoDrops, state.addictionScore, state.plinko);
  if (mode !== 'SINGLE' && progress.rows < (mode === 'TWIN' ? 9 : 12)) {
    throw new Error(`${mode} ist noch nicht freigeschaltet.`);
  }
  const board = createPlinkoBoard(state.plinko, progress.rows);
  const drop = board.drop(prng, mode, true);
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
  const base = drop.pockets.reduce((sum, pocket) => sum + pocketPayout(world.plinko, pocket), 0);
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
