/**
 * Spieler-Karriere: Level, Attribute, Koerper, Arbeit und Kampfbilanz als eine Sicht.
 *
 * Reine Ableitung aus dem vorhandenen Zustand - kein zweites Spielmodell, kein
 * eigenes Save-Feld. Die Kampfbilanz kommt aus dem Ereignisarchiv, weil dort
 * jedes Duell schon mit Ursache und Wirkung steht; ein zweiter Zaehler waere
 * eine zweite Wahrheit.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import type { JournalEvent } from './journal';
import { JOB_DEFS } from './player-jobs';
import {
  isInjured, playerHp, playerMaxHp, playerStepsPerTick, xpForNextLevel,
  type PlayerRpgState, type RpgAttribute,
} from './player-rpg';
import type { WorldState } from './types';

interface CareerAttribute {
  readonly id: RpgAttribute;
  readonly label: string;
  readonly level: number;
  /** Was diese Stufe im Spiel tatsaechlich bewirkt. */
  readonly effect: string;
}

interface CareerJob {
  readonly label: string;
  readonly rivalId: string;
  readonly workDays: number;
  readonly lastWorkDay: number;
}

interface CareerRecord {
  readonly wins: number;
  readonly losses: number;
}

interface CareerAchievement {
  readonly id: string;
  readonly label: string;
  readonly unlocked: boolean;
}

export interface PlayerCareer {
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
  readonly job: CareerJob | null;
  readonly record: CareerRecord;
  readonly achievements: readonly CareerAchievement[];
}

const INJURY_HP_PENALTY = 5;
const ACHIEVEMENT_LEVEL = 5;
const ACHIEVEMENT_WINS = 5;

/** Wirkung einer Stufe in Klartext; leer heisst "noch keine Wirkung im Spiel". */
function effectOf(rpg: PlayerRpgState, attr: RpgAttribute): string {
  if (attr === 'speed') return `${playerStepsPerTick(rpg)} Schritte pro Tick`;
  if (attr === 'charisma') return `${40 + rpg.charismaLevel * 10} % Ansprech-Chance`;
  if (attr === 'brawl') return `${6 + rpg.brawlLevel * 2} Schaden · ${playerMaxHp(rpg)} LP`;
  if (attr === 'endurance') return `Regeneration alle ${Math.max(2, 4 - Math.floor(rpg.enduranceLevel / 5))} Ticks`;
  return 'noch ohne Wirkung';
}

const ATTRIBUTE_LABELS: readonly (readonly [RpgAttribute, string])[] = [
  ['speed', 'Speed'],
  ['charisma', 'Charisma'],
  ['brawl', 'Brawl'],
  ['perception', 'Wahrnehmung'],
  ['technique', 'Technik'],
  ['endurance', 'Ausdauer'],
  ['luck', 'Glück'],
];

function levelOf(rpg: PlayerRpgState, attr: RpgAttribute): number {
  if (attr === 'speed') return rpg.speedLevel;
  if (attr === 'charisma') return rpg.charismaLevel;
  if (attr === 'brawl') return rpg.brawlLevel;
  if (attr === 'perception') return rpg.perceptionLevel;
  if (attr === 'technique') return rpg.techniqueLevel;
  if (attr === 'endurance') return rpg.enduranceLevel;
  return rpg.luckLevel;
}

/** Ein Duell im Archiv nennt Sieg oder Niederlage im Effekt; mehr braucht die Bilanz nicht. */
export function fightRecordOf(events: readonly JournalEvent[]): CareerRecord {
  let wins = 0;
  let losses = 0;
  for (const event of events) {
    if (!event.subject.startsWith('Duell gegen ')) continue;
    if (event.effect.startsWith('Gewonnen')) wins += 1;
    else if (event.effect.startsWith('Verloren')) losses += 1;
  }
  return { wins, losses };
}

function achievementsOf(world: WorldState, record: CareerRecord): readonly CareerAchievement[] {
  const rpg = world.player.rpg;
  const job = world.player.job;
  return [
    { id: 'ERSTE_SCHICHT', label: 'Erste Schicht gearbeitet', unlocked: (job?.workDays ?? 0) >= 1 },
    { id: 'ERSTER_SIEG', label: 'Erstes Duell gewonnen', unlocked: record.wins >= 1 },
    { id: 'DUELL_SERIE', label: `${ACHIEVEMENT_WINS} Duelle gewonnen`, unlocked: record.wins >= ACHIEVEMENT_WINS },
    { id: 'AUFSTEIGER', label: `Level ${ACHIEVEMENT_LEVEL} erreicht`, unlocked: rpg.level >= ACHIEVEMENT_LEVEL },
    { id: 'EIGENE_BUDE', label: 'Eigene Bude gekauft', unlocked: world.player.barPurchased },
    { id: 'ERSTE_VERLETZUNG', label: 'Erste Verletzung überstanden', unlocked: rpg.injuryTicks > 0 || rpg.hp < playerMaxHp(rpg) },
  ];
}

export function playerCareer(world: WorldState, wallet: VaCoinMicro, playerCash: VaCoinMicro): PlayerCareer {
  const rpg = world.player.rpg;
  const maxHp = playerMaxHp(rpg);
  const job = world.player.job;
  const record = fightRecordOf(world.archive);
  return {
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
    attributes: ATTRIBUTE_LABELS.map(([id, label]) => ({
      id, label, level: levelOf(rpg, id), effect: effectOf(rpg, id),
    })),
    job: job === null ? null : {
      label: JOB_DEFS[job.jobId].label,
      rivalId: job.rivalId,
      workDays: job.workDays,
      lastWorkDay: job.lastWorkDay,
    },
    record,
    achievements: achievementsOf(world, record),
  };
}

/** Klartext fuer den Koerper: die Anzeige sagt, was der naechste Kampf kostet. */
export function hpNotice(career: PlayerCareer): string {
  if (career.injured) return `Verletzt · noch ${career.injuryTicks} Ticks · ${career.hp}/${career.maxHp} LP - ${INJURY_HP_PENALTY} LP Risiko bei Arbeit`;
  return `${career.hp}/${career.maxHp} LP · kampfbereit`;
}
