/** Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. */
import type { Ledger } from '../core/economy/ledger';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { fromVC, mulVC, toVCString, type VaCoinMicro, addVC, subVC, ZERO_VC } from '../core/economy/vacoin';
import { gambleRivalWin, type RiskColor, type RiskOutcome } from '../core/games/risk-card';
import { recordJournal } from '../core/sim/journal';
import { recordExclusionPlay, EXCLUSION_PAUSE_TICKS } from '../core/sim/self-exclusion-bet';
import { EXTERNAL, foreignBet, foreignWin, PORTEMONNAIE } from '../core/sim/money';
import { getRival, rivalEdge, visitRival, type RivalId } from '../core/sim/rivals';
import type { WorldState } from '../core/sim/types';

interface ForeignOutcome {
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
 * Kartenrunden entscheiden sich Zug fuer Zug im Fenster: Der Einsatz wird beim
 * Austeilen gebucht, die Auszahlung erst am Rundenende. Wer das Fenster vorher
 * schliesst, hat trotzdem gespielt.
 */

/** Alles, was ein Fenster nach dem Austeilen kennt: Schuh-Seed, Hausquote, Maschine. */
export interface CardDeal {
  readonly seed: number;
  readonly netBps: number;
  readonly label: string;
}

/** Einsatz beim Austeilen: Valide ist hier die Voraussetzung, nicht beim Auszahlen. */
export function dealCardOutcome(
  world: WorldState, ledger: Ledger, prng: Prng, rivalId: RivalId, machineIndex: number, stakeVC: number, bps: number,
): { result: CardDeal; notice: string } {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  const stake = fromVC(stakeVC);
  if (stake < rival.minBet) throw new Error(`Mindesteinsatz im ${rival.name}: ${rival.minBet} Mikro.`);
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  const edge = rivalEdge(rival, entry);
  const netBps = bps > 0 ? Math.max(0, bps - edge) : 0;
  foreignBet(ledger, stake, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde Einsatz',
    effect: `${rival.name} (${entry.label}): ${stake / 10_000} VC eingesetzt`, refs: { rivalId },
  });
  // Einsatz bereits beim Austeilen im Pakt registrieren (auch bei Abbruch vor der Abrechnung).
  recordExclusionPlay(world, stake, ZERO_VC, world.tick);
  return { result: { seed: prng.nextInt(1, 2_147_483_646), netBps, label: entry.label }, notice: `Karten-Einsatz im ${rival.name} gebucht.` };
}

/** Auszahlung am Rundenende: hier darf keine Bude mehr pruefen, der Einsatz ist weg. */
export function settleCardOutcome(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number, stakeVC: number, netBps: number, label: string,
): ForeignOutcome {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  const stake = fromVC(stakeVC);
  const payout = mulVC(stake, netBps);
  if (payout > 0) foreignWin(ledger, payout, world.tick);
  // Gewinn im Pakt aktualisieren (Einsatz wurde bereits beim Austeilen gebucht).
  const pact = world.exclusionPact;
  if (pact && pact.status === 'ACTIVE') {
    pact.wins = addVC(pact.wins, payout);
    pact.netLoss = Math.max(0, subVC(pact.bets, pact.wins)) as VaCoinMicro;
    if (pact.netLoss >= pact.limit) {
      pact.status = 'LIMIT_REACHED';
      pact.thresholdTick = world.tick;
      pact.pauseUntilTick = world.tick + EXCLUSION_PAUSE_TICKS;
    }
  }
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde',
    effect: `${rival.name} (${entry.label}): ${label} · ${toVCString(payout)}`, refs: { rivalId },
  });
  return { result: { game: entry.game, stake, payout, multiplierBps: netBps, label, detail: [label] }, notice: `Kartenrunde im ${rival.name}: ${label}.` };
}

/** Bucht einen zusätzlichen Einsatz (Double, Split, Versicherung, Side Bet). */
export function additionalBet(world: WorldState, ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  if (ledger.getBalance(PORTEMONNAIE) < amount) throw new Error('Nicht genug Bargeld für den zusätzlichen Einsatz.');
  ledger.transfer(PORTEMONNAIE, EXTERNAL, amount, 'fremdes haus einsatz (zusatz)', tick);
  recordJournal(world, { kind: 'RIVAL', subject: '', cause: 'Zusätzlicher Einsatz', effect: `${amount / 10_000} VC zusätzlich eingesetzt` });
}
