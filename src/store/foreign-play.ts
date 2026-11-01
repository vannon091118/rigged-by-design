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
 * Kartenrunden entscheiden sich Zug fuer Zug im Fenster.
 * Einsatz wird sofort beim Austeilen gebucht (bookCardStake),
 * Auszahlung erst beim Rundenende (settleCardPayout).
 */
function validateCardRound(
  ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro,
): { rival: ReturnType<typeof getRival>; entry: ReturnType<typeof getRival>['machines'][number]; edge: number; netBps: (bps: number) => number } {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  if (stake < rival.minBet) throw new Error(`Mindesteinsatz im ${rival.name}: ${rival.minBet} Mikro.`);
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  const edge = rivalEdge(rival, entry);
  const netBps = (bps: number) => bps > 0 ? Math.max(0, bps - edge) : 0;
  return { rival, entry, edge, netBps };
}

/** Buchen des Einsatzes beim Austeilen. Gibt netBps zurueck, damit spaeter die Auszahlung berechnet werden kann. */
export function bookCardStake(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro, bps: number,
): { netBps: number; label: string } {
  const { rival, entry, netBps } = validateCardRound(ledger, rivalId, machineIndex, stake);
  foreignBet(ledger, stake, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde Einsatz',
    effect: `${rival.name} (${entry.label}): ${stake / 10_000} VC eingesetzt`, refs: { rivalId },
  });
  return { netBps: netBps(bps), label: entry.label };
}

/** Buchen der Auszahlung beim Rundenende. */
export function settleCardPayout(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro, netBps: number, label: string,
): GameResult {
  const { rival, entry } = validateCardRound(ledger, rivalId, machineIndex, stake);
  const payout = mulVC(stake, netBps);
  if (payout > 0) foreignWin(ledger, payout, world.tick);
  recordExclusionPlay(world, stake, payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde Auszahlung',
    effect: `${rival.name} (${entry.label}): ${label} · ${toVCString(payout)}`, refs: { rivalId },
  });
  return { game: entry.game, stake, payout, multiplierBps: netBps, label, detail: [label] };
}

/** Komplettbuchung (Legacy/Tests): Einsatz + Auszahlung in einem Schritt. */
export function bookCardRound(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number,
  stake: VaCoinMicro, bps: number, label: string,
): ForeignOutcome {
  const { netBps } = bookCardStake(world, ledger, rivalId, machineIndex, stake, bps);
  const result = settleCardPayout(world, ledger, rivalId, machineIndex, stake, netBps, label);
  return { result, notice: `Kartenrunde bei ${getRival(rivalId).name}: ${label}.` };
}
