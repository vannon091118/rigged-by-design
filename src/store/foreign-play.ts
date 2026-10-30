/** Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. */
import type { Ledger } from '../core/economy/ledger';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { fromVC, mulVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { gambleRivalWin, type RiskColor, type RiskOutcome } from '../core/games/risk-card';
import { recordJournal } from '../core/sim/journal';
import { recordExclusionPlay } from '../core/sim/self-exclusion-bet';
import { foreignBet, foreignWin, PORTEMONNAIE } from '../core/sim/money';
import { getRival, rivalEdge, visitRival, type RivalId } from '../core/sim/rivals';
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

function playRivalGame(
  ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng, tick: number,
  options: GameExtras = {},
): ForeignOutcome {
  const visit = visitRival(ledger, rivalId, machineIndex, fromVC(betVC), prng, tick, options);
  return { result: visit.result, notice: `${visit.rival.name} (${visit.machine.label}): ${payoutText(visit.result.payout)}` };
}

/** Besuch plus Journal: das fremde Haus ist ein System mit Zustand und Folge. */
export function visitRivalWithJournal(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng,
  options: GameExtras = {},
): ForeignOutcome {
  const outcome = playRivalGame(ledger, rivalId, machineIndex, betVC, prng, world.tick, options);
  recordExclusionPlay(world, fromVC(betVC), outcome.result.payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Besuch im fremden Haus',
    effect: outcome.notice, refs: { rivalId },
  });
  return outcome;
}

/**
 * Kartenrunden entscheiden sich Zug fuer Zug im Fenster; gebucht wird erst das
 * Ergebnis. Einsatz und Auszahlung laufen trotzdem ueber denselben Ledger-Pfad.
 */
function settleCardRound(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro, bps: number, label: string,
): GameResult {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  if (!Number.isSafeInteger(bps) || bps < 0) throw new Error(`Basisquote ${String(bps)} ist ungueltig.`);
  if (stake < rival.minBet) throw new Error(`Mindesteinsatz im ${rival.name}: ${rival.minBet} Mikro.`);
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  const edge = rivalEdge(rival, entry);
  const netBps = bps > 0 ? Math.max(0, bps - edge) : 0;
  foreignBet(ledger, stake, world.tick);
  const payout = mulVC(stake, netBps);
  if (payout > 0) foreignWin(ledger, payout, world.tick);
  recordExclusionPlay(world, stake, payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde',
    effect: `${rival.name} (${entry.label}): ${label} · ${toVCString(payout)}`, refs: { rivalId },
  });
  return { game: entry.game, stake, payout, multiplierBps: netBps, label, detail: [label] };
}

/** Wickelt die Kartenbuchung in die Form, die der Store fuer #foreign erwartet. */
export function bookCardRound(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro, bps: number, label: string,
): ForeignOutcome {
  const result = settleCardRound(world, ledger, rivalId, machineIndex, stake, bps, label);
  return { result, notice: `Kartenrunde bei ${getRival(rivalId).name}: ${label}.` };
}
