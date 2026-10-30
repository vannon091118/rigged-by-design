/** Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. */
import type { Ledger } from '../core/economy/ledger';
import type { GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { recordJournal } from '../core/sim/journal';
import { visitRival, type RivalId } from '../core/sim/rivals';
import type { WorldState } from '../core/sim/types';

export interface ForeignOutcome {
  readonly result: GameResult;
  readonly notice: string;
}

const payoutText = (payout: VaCoinMicro): string =>
  payout > 0 ? `${toVCString(payout)} zurück.` : 'Verloren.';

function playRivalGame(
  ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng, tick: number,
): ForeignOutcome {
  const visit = visitRival(ledger, rivalId, machineIndex, fromVC(betVC), prng, tick);
  return { result: visit.result, notice: `${visit.rival.name} (${visit.machine.label}): ${payoutText(visit.result.payout)}` };
}

/** Besuch plus Journal: das fremde Haus ist ein System mit Zustand und Folge. */
export function visitRivalWithJournal(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng,
): ForeignOutcome {
  const outcome = playRivalGame(ledger, rivalId, machineIndex, betVC, prng, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Besuch im fremden Haus',
    effect: outcome.notice, refs: { rivalId },
  });
  return outcome;
}
