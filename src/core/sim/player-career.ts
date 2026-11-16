/**
 * Spieler-Karriere: Level, Attribute, Koerper, Arbeit und Kampfbilanz als eine Sicht.
 *
 * Reine Ableitung aus dem vorhandenen Zustand - kein zweites Spielmodell, kein
 * eigenes Save-Feld. Die Kampfbilanz kommt aus dem Ereignisarchiv, weil dort
 * jedes Duell schon mit Ursache und Wirkung steht; ein zweiter Zaehler waere
 * eine zweite Wahrheit.
 *
 * Attribute und Fach-Skills sind in eigene Module ausgelagert (Hot Zone Budget).
 */

import type { VaCoinMicro } from '../economy/vacoin';
import { arenaView, type ArenaView } from './arena';
import { esportView, type EsportView } from './esport';
import { fightBetView, type FightBetView } from './fight-bets';
import { backyardView, type BackyardView } from './fight-career';
import { fightEventView, type FightEventView } from './fight-event';
import { fightRecordOf as fightRecordOfAll, type FightRecord } from './fight-history';
import { playerHistoryOf, type PlayerHistoryEntry } from './player-history';
import { propertyView, type PlayerPropertyView } from './property';
import type { JournalEvent } from './journal';
import { JOB_DEFS } from './player-jobs';
import { normalizePlayerNeeds, playerNeedsView, type PlayerNeedsView } from './player-needs';
import {
  isInjured, playerHp, playerMaxHp, xpForNextLevel,
} from './player-rpg';
export { effectOf, ATTRIBUTE_LABELS } from './player-career-attributes';
import type { CareerAttribute } from './player-career-attributes';
export type { CareerAttribute } from './player-career-attributes';
import type { CareerSkill } from './player-career-skills';
export type { CareerSkill } from './player-career-skills';
export { SKILL_XP_SOURCES, skillIdForSource } from './player-skills';
export type { SkillProgression, PlayerSkillState } from './player-skills';
import { careerAttributes } from './player-career-attributes';
import { careerSkills } from './player-career-skills';
import type { WorldState } from './types';

interface CareerJob {
  readonly label: string;
  readonly rivalId: string;
  readonly workDays: number;
  readonly lastWorkDay: number;
  /** Tageslohn aus derselben Job-Definition, die den Lohn bucht. */
  readonly wageVC: number;
}

interface CareerAchievement {
  readonly id: string;
  readonly label: string;
  readonly unlocked: boolean;
}

export interface PlayerCareer {
  readonly needs: PlayerNeedsView;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly unspentPoints: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly injured: boolean;
  readonly injuryTicks: number;
  readonly wallet: VaCoinMicro;
  readonly playerCash: VaCoinMicro;
  readonly attributes: readonly CareerAttribute[];
  readonly skills: readonly CareerSkill[];
  readonly job: CareerJob | null;
  readonly record: FightRecord;
  readonly achievements: readonly CareerAchievement[];
  /** Letzte eigene Etappen aus dem Ereignisarchiv (Kaempfe, Buden-Kauf). */
  readonly history: readonly PlayerHistoryEntry[];
  /** Hinterhof-Leiter, Gegnerhistorie und Startgeld aus derselben Ableitung. */
  readonly backyard: BackyardView;
  /** Kampfabend im vorhandenen Turnierabend: Roster, Nenngeld und Zuschauer. */
  readonly event: FightEventView;
  /** Arena-Ausbau der eigenen Immobilie mit Stufe, Plaetzen und Einlasspreis. */
  readonly arena: ArenaView;
  /** Wettmarkt auf den Vorkampf des Abends, mit fixierten Scheinen. */
  readonly bets: FightBetView;
  /** Stadtliga mit Teams, Rollen, Form und Historie aus derselben Ableitung. */
  readonly esport: EsportView;
  /** Erste Immobilie mit Katalog, Preis und Bezahlbarkeit aus dem Portemonnaie. */
  readonly property: PlayerPropertyView;
}

const INJURY_HP_PENALTY = 5;

/** Ein Kampf im Archiv nennt Sieg oder Niederlage im Effekt; mehr braucht die Bilanz nicht. */
export function fightRecordOf(events: readonly JournalEvent[]): FightRecord {
  return fightRecordOfAll(events);
}

export function playerCareer(world: WorldState, wallet: VaCoinMicro, playerCash: VaCoinMicro): PlayerCareer {
  const rpg = world.player.rpg;
  const maxHp = playerMaxHp(rpg);
  const job = world.player.job;
  const record = fightRecordOf(world.archive);
  return {
    needs: playerNeedsView(normalizePlayerNeeds(world.player.needs)),
    level: rpg.level,
    xp: rpg.xp,
    xpToNext: Math.max(0, xpForNextLevel(rpg.level) - rpg.xp),
    unspentPoints: rpg.unspentPoints,
    hp: playerHp(rpg),
    maxHp,
    injured: isInjured(rpg),
    injuryTicks: rpg.injuryTicks,
    wallet,
    playerCash,
    attributes: careerAttributes(world),
    skills: careerSkills(world),
    job: job === null ? null : {
      label: JOB_DEFS[job.jobId].label,
      rivalId: job.rivalId,
      workDays: job.workDays,
      lastWorkDay: job.lastWorkDay,
      wageVC: JOB_DEFS[job.jobId].dailyWageVC,
    },
    record,
    achievements: achievementsOf(world, record),
    history: playerHistoryOf(world.archive),
    backyard: backyardView(world, wallet),
    event: fightEventView(world, wallet),
    arena: arenaView(world),
    bets: fightBetView(world, wallet),
    esport: esportView(world),
    property: propertyView(world, wallet),
  };
}

/** Klartext fuer den Koerper: die Anzeige sagt, was der naechste Kampf kostet. */
export function hpNotice(career: PlayerCareer): string {
  if (career.injured) return `Verletzt · noch ${career.injuryTicks} Ticks · ${career.hp}/${career.maxHp} LP - ${INJURY_HP_PENALTY} LP Risiko bei Arbeit`;
  return `${career.hp}/${career.maxHp} LP · kampfbereit`;
}

/** Erfolgsabzeichen aus Spielzustand und Kampfbilanz. */
function achievementsOf(world: WorldState, record: FightRecord): readonly CareerAchievement[] {
  const rpg = world.player.rpg;
  const job = world.player.job;
  return [
    { id: 'ERSTE_SCHICHT', label: 'Erste Schicht gearbeitet', unlocked: (job?.workDays ?? 0) >= 1 },
    { id: 'ERSTER_SIEG', label: 'Erstes Duell gewonnen', unlocked: record.wins >= 1 },
    { id: 'DUELL_SERIE', label: `5 Duelle gewonnen`, unlocked: record.wins >= 5 },
    { id: 'AUFSTEIGER', label: 'Level 5 erreicht', unlocked: rpg.level >= 5 },
    { id: 'EIGENE_BUDE', label: 'Eigene Bude gekauft', unlocked: world.player.barPurchased },
    { id: 'ERSTE_IMMOBILIE', label: 'Erste Immobilie gekauft', unlocked: world.player.properties.length > 0 },
    { id: 'ERSTE_VERLETZUNG', label: 'Erste Verletzung ueberstanden', unlocked: rpg.injuryTicks > 0 || rpg.hp < playerMaxHp(rpg) },
  ];
}
