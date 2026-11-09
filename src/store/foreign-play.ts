/** Fremde Haeuser: Spiel und Besuch. */
import type { Ledger } from '../core/economy/ledger';
import type { GameExtras, GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { addVC, fromVC, mulVC, subVC, toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { gambleRivalWin, type RiskColor, type RiskOutcome } from '../core/games/risk-card';
import { recordJournal } from '../core/sim/journal';
import { recordExclusionPlay, recordExclusionWin } from '../core/sim/self-exclusion-bet';
import { EXTERNAL, foreignBet, foreignWin, PORTEMONNAIE } from '../core/sim/money';
import { getRival, rivalEdge, visitRival, type RivalId } from '../core/sim/rivals';
import { grantGlobalXp } from '../core/sim/player-rpg';
import { emitFact } from '../core/sim/narrative/facts';
import { actorRefOfRival } from '../core/sim/narrative/relationships';
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
    if (outcome.won) grantGlobalXp(world.player.rpg, 'RISK_CARD_WIN', 20);
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
  const netToHouse = (outcome.result.payout - outcome.result.stake) as VaCoinMicro;
  if (netToHouse !== 0) {
    emitFact(world, {
      kind: 'RIVAL_ENCOUNTER', actorRefs: [actorRefOfRival(rivalId), 'player'], rivalId, netToHouse,
    });
  }
  recordExclusionPlay(world, fromVC(betVC), outcome.result.payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Besuch im fremden Haus',
    effect: outcome.notice, refs: { rivalId },
  });
  // Globale XP für fremdes Spielen
  grantGlobalXp(world.player.rpg, 'FOREIGN_PLAY', 5);
  if (outcome.result.payout > outcome.result.stake * 10) {
    grantGlobalXp(world.player.rpg, 'FOREIGN_JACKPOT', 50);
  }
  return outcome;
}

/**
 * Kartenrunden entscheiden sich Zug fuer Zug im Fenster: Der Einsatz wird beim
 * Austeilen gebucht, die Auszahlung erst am Rundenende. Wer das Fenster vorher
 * schliesst, hat trotzdem gespielt.
 */

// Unsettled Kartenrunde je Maschine: Einsatz bindet Deal an Settle.
export interface CardDeal {
  readonly seed: number;
  readonly label: string;
}

/** Offene Kartenrunde je (Rivale, Maschine); Einsatz bindet Deal an Settle. */
const pendingCard = new Map<string, { stake: VaCoinMicro }>();
const pendingKey = (rivalId: RivalId, machineIndex: number): string => `${rivalId}:${machineIndex}`;
const MAX_CARD_ENGINE_BPS = 2_500_000;
export function dealCardOutcome(
  world: WorldState, ledger: Ledger, prng: Prng, rivalId: RivalId, machineIndex: number, stakeVC: number,
): { result: CardDeal; notice: string } {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  const key = pendingKey(rivalId, machineIndex);
  if (pendingCard.has(key)) throw new Error('An diesem Tisch läuft noch eine Kartenrunde.');
  const stake = fromVC(stakeVC);
  if (stake < rival.minBet) throw new Error(`Mindesteinsatz im ${rival.name}: ${rival.minBet} Mikro.`);
  if (!Number.isSafeInteger(stake) || stake <= ZERO_VC) throw new Error('Kein gültiger Einsatz.');
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  foreignBet(ledger, stake, world.tick);
  pendingCard.set(key, { stake });
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde Einsatz',
    effect: `${rival.name} (${entry.label}): ${stake / 10_000} VC eingesetzt`, refs: { rivalId },
  });
  // Einsatz bereits beim Austeilen im Pakt registrieren (auch bei Abbruch vor der Abrechnung).
  recordExclusionPlay(world, stake, ZERO_VC, world.tick);
  return { result: { seed: prng.nextInt(1, 2_147_483_646), label: entry.label }, notice: `Karten-Einsatz im ${rival.name} gebucht.` };
}

/** Hausvorteil nur auf den Gewinn: Einsatz und Refund bleiben unangetastet. */
export function cardPayout(stake: VaCoinMicro, engineBps: number, edgeBps: number): VaCoinMicro {
  const gross = mulVC(stake, engineBps);
  if (gross <= stake) return gross;
  return addVC(stake, mulVC(subVC(gross, stake), Math.max(0, 10_000 - edgeBps)));
}

/** Auszahlung nur fuer offene Runde, Einsatz und gecappte Quote. */
export function settleCardOutcome(
  world: WorldState, ledger: Ledger, rivalId: RivalId, machineIndex: number, stakeVC: number, engineBps: number, label: string,
): ForeignOutcome {
  const rival = getRival(rivalId);
  const entry = rival.machines[machineIndex];
  if (!entry) throw new Error('Diese Maschine gibt es dort nicht.');
  const key = pendingKey(rivalId, machineIndex);
  const pending = pendingCard.get(key);
  if (!pending) throw new Error('Keine offene Kartenrunde an dieser Maschine.');
  if (!Number.isSafeInteger(engineBps) || engineBps < 0 || engineBps > MAX_CARD_ENGINE_BPS) throw new Error(`Ungültige Quote ${String(engineBps)}.`);
  const stake = fromVC(stakeVC);
  if (stake !== pending.stake) throw new Error('Einsatz passt nicht zur offenen Kartenrunde.');
  pendingCard.delete(key);
  const payout = cardPayout(stake, engineBps, rivalEdge(rival, entry));
  if (payout > 0) foreignWin(ledger, payout, world.tick);
  const netToHouse = (payout - stake) as VaCoinMicro;
  if (netToHouse !== 0) {
    emitFact(world, {
      kind: 'RIVAL_ENCOUNTER', actorRefs: [actorRefOfRival(rivalId), 'player'], rivalId, netToHouse,
    });
  }
  recordExclusionWin(world, payout, world.tick);
  recordJournal(world, {
    kind: 'RIVAL', subject: rivalId, cause: 'Kartenrunde',
    effect: `${rival.name} (${entry.label}): ${label} · ${toVCString(payout)}`, refs: { rivalId },
  });
  const multiplierBps = stake > 0 ? Math.round((payout / stake) * 10_000) : 0;
  return { result: { game: entry.game, stake, payout, multiplierBps, label, detail: [label] }, notice: `Kartenrunde im ${rival.name}: ${label}.` };
}

/** Bucht einen zusätzlichen Einsatz (Double, Split, Versicherung). */
export function additionalBet(world: WorldState, ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  if (ledger.getBalance(PORTEMONNAIE) < amount) throw new Error('Nicht genug Bargeld für den zusätzlichen Einsatz.');
  ledger.transfer(PORTEMONNAIE, EXTERNAL, amount, 'fremdes haus einsatz (zusatz)', tick);
  recordExclusionPlay(world, amount, ZERO_VC, tick);
  recordJournal(world, { kind: 'RIVAL', subject: '', cause: 'Zusätzlicher Einsatz', effect: `${amount / 10_000} VC zusätzlich eingesetzt` });
}
