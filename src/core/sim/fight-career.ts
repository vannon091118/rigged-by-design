/**
 * Hinterhof-Karriere: herausforderbare Gegner, Startgeld und Preisgeld.
 *
 * Die Leiter und die Sicht sind Ableitungen; Geld laeuft ausschliesslich ueber
 * den Ledger, gekaempft wird mit der bestehenden Mechanik aus `brawl-combat`.
 * Kein Save-Feld, kein zweiter Zaehler.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { applyFightOutcome, fighters, simulateFight, winProbability } from './brawl-combat';
import type { DuelOpponent } from './duel-opponent';
import {
  backyardHistoryOf, backyardSubject, fightRecordOf,
  type BackyardHistoryEntry, type FightRecord,
} from './fight-history';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { grantGlobalXp, isInjured, type PlayerRpgState } from './player-rpg';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';

const XP_WIN = 30;
const XP_PER_STRENGTH = 4;

export interface BackyardRung {
  readonly rank: number;
  readonly name: string;
  readonly archetype: string;
  readonly strength: number;
  readonly toughness: number;
  readonly entryFee: VaCoinMicro;
  readonly prize: VaCoinMicro;
}

export interface BackyardView {
  readonly rung: BackyardRung;
  readonly totalRungs: number;
  readonly winChance: number;
  readonly ready: boolean;
  readonly reason: string;
  readonly record: FightRecord;
  readonly history: readonly BackyardHistoryEntry[];
}

export interface BackyardResult {
  readonly won: boolean;
  readonly ko: boolean;
  readonly fee: VaCoinMicro;
  readonly prize: VaCoinMicro;
  readonly notice: string;
}

/** Die Leiter steigt in Kraft, Preisgeld und Startgeld; Rang ergibt sich aus der Position. */
const LADDER: readonly Omit<BackyardRung, 'rank'>[] = [
  { name: 'Bulle Bernd', archetype: 'Hinterhof-Schläger', strength: 2, toughness: 2, entryFee: fromVC(0.5), prize: fromVC(1.2) },
  { name: 'Zora Zeck', archetype: 'Ring-Anfängerin', strength: 3, toughness: 3, entryFee: fromVC(1), prize: fromVC(2.4) },
  { name: 'Taifun Tarek', archetype: 'Boxer', strength: 4, toughness: 4, entryFee: fromVC(2), prize: fromVC(5) },
  { name: 'Mimi Marder', archetype: 'Kickboxerin', strength: 5, toughness: 5, entryFee: fromVC(3), prize: fromVC(8) },
  { name: 'Koloss Kaya', archetype: 'Catcherin', strength: 7, toughness: 6, entryFee: fromVC(5), prize: fromVC(14) },
  { name: 'Der Schlachter', archetype: 'Endgegner', strength: 9, toughness: 8, entryFee: fromVC(8), prize: fromVC(24) },
];

/**
 * Der naechste Gegner ist der erste unbezwungene der Leiter; ist die Leiter
 * abgeraeumt, bleibt der Endgegner herausforderbar - der Loop endet nie.
 */
function nextRung(history: readonly BackyardHistoryEntry[]): BackyardRung {
  const beaten = new Set(history.filter((entry) => entry.wins > 0).map((entry) => entry.name));
  const index = LADDER.findIndex((rung) => !beaten.has(rung.name));
  const base = LADDER[index === -1 ? LADDER.length - 1 : index]!;
  return { ...base, rank: index === -1 ? LADDER.length : index + 1 };
}

function opponentOf(rung: BackyardRung): DuelOpponent {
  return {
    guestId: -1, name: rung.name, archetype: rung.archetype, strength: rung.strength,
    greed: rung.rank, nerve: rung.strength, toughness: rung.toughness,
  };
}

/** Dieselbe Kampfmechanik wie im Duell; ohne Casino-Menge gibt es keinen Stimmungsbonus. */
function chanceOf(rpg: PlayerRpgState, rung: BackyardRung): number {
  const [player, rival] = fighters(rpg, opponentOf(rung), 0);
  return Math.round(winProbability(player, rival) * 100);
}

export function backyardView(world: WorldState, wallet: VaCoinMicro): BackyardView {
  const history = backyardHistoryOf(world.archive);
  const rung = nextRung(history);
  const injured = isInjured(world.player.rpg);
  const ready = !injured && wallet >= rung.entryFee;
  const reason = injured
    ? `Verletzt: noch ${world.player.rpg.injuryTicks} Ticks, kein Kampf.`
    : wallet < rung.entryFee
      ? `Startgeld fehlt: ${toVCString((rung.entryFee - wallet) as VaCoinMicro)}.`
      : `Startgeld ${toVCString(rung.entryFee)} · Preisgeld ${toVCString(rung.prize)}.`;
  return {
    rung, totalRungs: LADDER.length, winChance: chanceOf(world.player.rpg, rung), ready, reason,
    record: fightRecordOf(world.archive), history,
  };
}

/**
 * Ein Hinterhofkampf: Startgeld geht vom Portemonnaie an die Aussenwelt, das
 * Preisgeld kommt bei einem Sieg zurueck. Eine Niederlage kostet Startgeld,
 * Lebenspunkte und eine Verletzung - der Preis fuer den naechsten Versuch.
 */
export function backyardFight(world: WorldState, ledger: Ledger, prng: Prng): BackyardResult {
  const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
  if (!view.ready) throw new Error(view.reason);
  const rung = view.rung;
  ledger.transfer(PORTEMONNAIE, EXTERNAL, rung.entryFee, TX_REASON.BACKYARD_ENTRY, world.tick);
  const [player, rival] = fighters(world.player.rpg, opponentOf(rung), 0);
  const fight = simulateFight(player, rival, prng);
  applyFightOutcome(world.player.rpg, fight, player.maxHp);
  const won = fight.playerWon;
  const ko = won ? fight.opponentHp === 0 : fight.playerHp === 0;
  let prize: VaCoinMicro = ZERO_VC;
  if (won) {
    prize = rung.prize;
    ledger.transfer(EXTERNAL, PORTEMONNAIE, prize, TX_REASON.BACKYARD_PRIZE, world.tick);
    grantGlobalXp(world.player.rpg, 'WIN_BRAWL', XP_WIN + rung.strength * XP_PER_STRENGTH);
  }
  const outcome = `${won ? 'Gewonnen' : 'Verloren'}: ${ko ? 'KO' : 'nach Punkten'} in Runde ${fight.rounds}`;
  const money = won ? `Preisgeld ${toVCString(prize)}` : `Startgeld ${toVCString(rung.entryFee)} verloren`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: backyardSubject(rung.name),
    cause: `${rung.archetype} · Rang ${rung.rank}/${LADDER.length} · Startgeld ${toVCString(rung.entryFee)}`,
    effect: `${outcome} · ${money}.`,
    amount: won ? prize : rung.entryFee,
  });
  const notice = `${outcome} gegen ${rung.name} · ${money}.`;
  world.lastEvent = notice;
  return { won, ko, fee: rung.entryFee, prize, notice };
}
