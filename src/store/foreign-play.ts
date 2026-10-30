/** Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. */
import type { Ledger } from '../core/economy/ledger';
import type { GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { gambleRivalWin, type RiskColor, type RiskOutcome } from '../core/games/risk-card';
import type { DiceBetKind } from '../core/games/dice-bets';
import { recordJournal } from '../core/sim/journal';
import { recordExclusionPlay } from '../core/sim/self-exclusion-bet';
import { getRival, visitRival, type RivalId } from '../core/sim/rivals';
import type { WorldState } from '../core/sim/types';

export interface ForeignOutcome {
  readonly result: GameResult;
  readonly notice: string;
}

interface RiskBooking {
  readonly outcome: RiskOutcome | null;
  readonly notice: string;
}

/** Risiko-Karte im fremden Haus: verdoppeln oder zurueckbuchen, beides im Journal. */
export function riskRivalWin(
  world: WorldState, ledger: Ledger, rivalId: RivalId, stake: VaCoinMicro, color: RiskColor, prng: Prng,
): RiskBooking {
  try {
    const outcome = gambleRivalWin(ledger, stake, color, prng, world.tick);
    const notice = `Risiko-Karte bei ${getRival(rivalId).name}: ${outcome.card} · ${outcome.won ? 'verdoppelt' : 'verloren'}.`;
    recordJournal(world, { kind: 'RIVAL', subject: rivalId, cause: 'Risiko-Karte', effect: notice, refs: { rivalId } });
    return { outcome, notice };
  } catch (error) {
    return { outcome: null, notice: error instanceof Error ? error.message : 'Risiko-Karte fehlgeschlagen.' };
  }
}

const payoutText = (payout: VaCoinMicro): string =>
  payout > 0 ? `${toVCString(payout)} zurück.` : 'Verloren.';

interface PlayOptions {
  readonly variant?: DiceBetKind;
  readonly captureTrack?: boolean;
}

function playRivalGame(
  ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng, tick: number,
  options: PlayOptions = {},
): ForeignOutcome {
  const visit = visitRival(ledger, rivalId, machineIndex, fromVC(betVC), prng, tick, options);
  return { result: visit.result, notice: `${visit.rival.name} (${visit.machine.label}): ${payoutText(visit.result.payout)}` };
}

/** Besuch plus Journal: das fremde Haus ist ein System mit Zustand und Folge. */
export function visitRivalWithJournal(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng,
  options: PlayOptions = {},
): ForeignOutcome {
  const outcome = playRivalGame(ledger, rivalId, machineIndex, betVC, prng, world.tick, options);
  recordExclusionPlay(world, fromVC(betVC), outcome.result.payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Besuch im fremden Haus',
    effect: outcome.notice, refs: { rivalId },
  });
  return outcome;
}
