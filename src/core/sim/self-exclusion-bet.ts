/** Self-Exclusion als Spiel: Der Pakt belohnt Disziplin und protokolliert Wortbruch ehrlich. */
import type { Ledger } from '../economy/ledger';
import { addVC, mulVC, subVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { EXTERNAL_WORK, PLAYER_CASH } from './money';
import type { WorldState } from './types';

type ExclusionStatus = 'ACTIVE' | 'LIMIT_REACHED' | 'HELD' | 'BROKEN';
export interface ExclusionPact {
  readonly limit: VaCoinMicro;
  readonly reward: VaCoinMicro;
  bets: VaCoinMicro;
  wins: VaCoinMicro;
  netLoss: VaCoinMicro;
  status: ExclusionStatus;
  thresholdTick: number;
  pauseUntilTick: number;
}
interface ExclusionResult { readonly ok: boolean; readonly reward: VaCoinMicro; readonly notice: string; }

const EXCLUSION_PAUSE_TICKS = 8;

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function startExclusionPact(
  world: WorldState,
  ledger: Ledger,
  limit: VaCoinMicro,
  tick: number,
): ExclusionResult {
  if (limit <= ZERO_VC) throw new Error('Das Verlustlimit muss positiv sein.');
  if (world.exclusionPact?.status === 'ACTIVE' || world.exclusionPact?.status === 'LIMIT_REACHED') {
    throw new Error('Es läuft bereits ein Selbstbeherrschungs-Pakt.');
  }
  const reward = mulVC(limit, 2_500);
  const reserve = ledger.getBalance(EXTERNAL_WORK);
  if (reserve < reward) ledger.transfer('EXTERNAL_WORLD', EXTERNAL_WORK, subVC(reward, reserve), 'disziplin-pakt reserve', tick);
  world.exclusionPact = {
    limit, reward, bets: ZERO_VC, wins: ZERO_VC, netLoss: ZERO_VC,
    status: 'ACTIVE', thresholdTick: -1, pauseUntilTick: -1,
  };
  return { ok: true, reward, notice: `Pakt geschlossen: Stopp bei -${(limit / 10_000).toFixed(2)} VC.` };
}

/** Wird nach jedem echten Fremdspiel aufgerufen; ein weiterer Spin nach dem Limit bricht den Pakt. */
export function recordExclusionPlay(
  world: WorldState,
  bet: VaCoinMicro,
  payout: VaCoinMicro,
  tick: number,
): void {
  world.playerAddictionScore = clampScore(world.playerAddictionScore + 0.75);
  const pact = world.exclusionPact;
  if (!pact || pact.status === 'HELD' || pact.status === 'BROKEN') return;
  if (pact.status === 'LIMIT_REACHED') {
    pact.status = 'BROKEN';
    world.brokenExclusionPacts += 1;
    world.playerAddictionScore = clampScore(world.playerAddictionScore + 12);
    return;
  }
  pact.bets = addVC(pact.bets, bet);
  pact.wins = addVC(pact.wins, payout);
  pact.netLoss = Math.max(0, subVC(pact.bets, pact.wins)) as VaCoinMicro;
  if (pact.netLoss >= pact.limit) {
    pact.status = 'LIMIT_REACHED';
    pact.thresholdTick = tick;
    pact.pauseUntilTick = tick + EXCLUSION_PAUSE_TICKS;
  }
}

/** Erst nach der vereinbarten Pause wird der Bonus gebucht; vorher ist es ein Wortbruch. */
export function honorExclusionPact(world: WorldState, ledger: Ledger, tick: number): ExclusionResult {
  const pact = world.exclusionPact;
  if (!pact || pact.status !== 'LIMIT_REACHED') throw new Error('Kein Pakt an der Verlustgrenze.');
  if (tick < pact.pauseUntilTick) throw new Error(`Noch ${pact.pauseUntilTick - tick} Ticks Pause einhalten.`);
  ledger.transfer(EXTERNAL_WORK, PLAYER_CASH, pact.reward, 'disziplin-bonus', tick);
  pact.status = 'HELD';
  world.clarityBadge = true;
  world.playerAddictionScore = clampScore(world.playerAddictionScore - 20);
  return {
    ok: true,
    reward: pact.reward,
    notice: `Pakt eingehalten: +${(pact.reward / 10_000).toFixed(2)} VC Disziplin-Bonus.`,
  };
}
