/**
 * Karriereleitern der vier Spielerjobs (#803).
 *
 * Zwei Stufen je Linie, keine stille Befoerderung: Der Aufstieg ist ein
 * Angebot, das belegte Leistung, die passende Fach-Skill und genug Schichten
 * in der aktuellen Stufe verlangt. Der Rang veraendert Lohn und Schichtdauer
 * ueber dieselben Definitionen, die die Arbeit ausfuehrt.
 */
import { recordJournal } from './journal';
import type { PlayerJobId, PlayerJobState, WorldState } from './types';
import type { PlayerSkillId } from './player-skills';

interface JobRankDef {
  readonly index: number;
  readonly label: string;
  /** Lohnfaktor gegenueber dem Einstiegslohn der Job-Definition. */
  readonly wageMultiplier: number;
  /** Faktor auf die Schichtdauer; Leitung arbeitet kuerzer, traegt aber Verantwortung. */
  readonly durationFactor: number;
}

const JOB_LADDERS: Readonly<Record<PlayerJobId, readonly JobRankDef[]>> = {
  CLEANER: [
    { index: 0, label: 'Reinigungskraft', wageMultiplier: 1, durationFactor: 1 },
    { index: 1, label: 'Vorarbeiter Reinigung', wageMultiplier: 1.5, durationFactor: 0.85 },
  ],
  BARTENDER: [
    { index: 0, label: 'Barkeeper', wageMultiplier: 1, durationFactor: 1 },
    { index: 1, label: 'Schichtleitung Bar', wageMultiplier: 1.5, durationFactor: 0.85 },
  ],
  CARD_DEALER: [
    { index: 0, label: 'Croupier', wageMultiplier: 1, durationFactor: 1 },
    { index: 1, label: 'Tischleitung', wageMultiplier: 1.5, durationFactor: 0.85 },
  ],
  MECHANIC: [
    { index: 0, label: 'Automaten-Mechaniker', wageMultiplier: 1, durationFactor: 1 },
    { index: 1, label: 'Senior-Techniker', wageMultiplier: 1.5, durationFactor: 0.85 },
  ],
};

/** Die Fach-Skill, die eine Joblinie traegt; dieselbe Zuordnung wie beim XP-Gewinn. */
export const JOB_SKILL: Readonly<Record<PlayerJobId, PlayerSkillId>> = {
  CLEANER: 'cleaning',
  BARTENDER: 'service',
  CARD_DEALER: 'cardDealing',
  MECHANIC: 'repair',
};

/** Drei belegte Schichten, 60 Punkte Durchschnitt und Fach-Skill 3. */
const PROMOTION_MIN_SHIFTS = 3;
const PROMOTION_MIN_QUALITY = 60;
const PROMOTION_MIN_SKILL = 3;

/** Die aktuelle Stufe; ein zu hoher Rang faellt auf die letzte Stufe zurueck. */
export function jobRankOf(job: PlayerJobState): JobRankDef {
  const ladder = JOB_LADDERS[job.jobId];
  return ladder[Math.min(Math.max(0, job.rank), ladder.length - 1)]!;
}

function nextJobRank(job: PlayerJobState): JobRankDef | null {
  const ladder = JOB_LADDERS[job.jobId];
  const next = Math.max(0, job.rank) + 1;
  return next < ladder.length ? ladder[next]! : null;
}

/** Lohn aus Job-Definition und Rang; die Ledger-Buchung nutzt genau diesen Wert. */
export function jobWageVC(baseWageVC: number, job: PlayerJobState): number {
  return Math.max(1, Math.round(baseWageVC * jobRankOf(job).wageMultiplier));
}

/** Schichtdauer aus Job-Definition und Rang. */
export function jobTaskTicks(baseTicks: number, job: PlayerJobState): number {
  return Math.max(10, Math.round(baseTicks * jobRankOf(job).durationFactor));
}

/** Durchschnitt der Schichten in der aktuellen Stufe; 0 heisst: noch keine. */
export function jobAverageQuality(job: PlayerJobState): number {
  if (job.rankShifts <= 0) return 0;
  return Math.round((job.rankQuality / job.rankShifts) * 10) / 10;
}

interface PromotionRequirement {
  readonly id: 'shifts' | 'quality' | 'skill';
  readonly label: string;
  readonly met: boolean;
  /** Warum die Bedingung erfuellt oder nicht erfuellt ist. */
  readonly detail: string;
}

export interface JobPromotionView {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly available: boolean;
  readonly requirements: readonly PromotionRequirement[];
  /** Konkreter Grund, wenn kein Aufstieg moeglich ist; sonst leer. */
  readonly blockReason: string;
  readonly averageQuality: number;
  readonly skillLevel: number;
}

function requirementsFor(world: WorldState, job: PlayerJobState): PromotionRequirement[] {
  const skillId = JOB_SKILL[job.jobId];
  const level = world.player.skills[skillId].level;
  const average = jobAverageQuality(job);
  return [
    {
      id: 'shifts',
      label: `Mindestens ${PROMOTION_MIN_SHIFTS} Schichten in dieser Stufe`,
      met: job.rankShifts >= PROMOTION_MIN_SHIFTS,
      detail: `${job.rankShifts}/${PROMOTION_MIN_SHIFTS}`,
    },
    {
      id: 'quality',
      label: `Durchschnittliche Schichtqualitaet ab ${PROMOTION_MIN_QUALITY}`,
      met: average >= PROMOTION_MIN_QUALITY,
      detail: `${average}`,
    },
    {
      id: 'skill',
      label: `Fach-Skill ${skillId} ab Stufe ${PROMOTION_MIN_SKILL}`,
      met: level >= PROMOTION_MIN_SKILL,
      detail: `Stufe ${level}`,
    },
  ];
}

/** Das Aufstiegsangebot; `null`, wenn der Job keine weitere Stufe hat. */
export function jobPromotionView(world: WorldState): JobPromotionView | null {
  const job = world.player.job;
  if (job === null) return null;
  const next = nextJobRank(job);
  if (next === null) return null;
  const requirements = requirementsFor(world, job);
  const missing = requirements.filter((entry) => !entry.met);
  return {
    fromLabel: jobRankOf(job).label,
    toLabel: next.label,
    available: missing.length === 0,
    requirements,
    blockReason: missing.map((entry) => `${entry.label} (${entry.detail})`).join('; '),
    averageQuality: jobAverageQuality(job),
    skillLevel: world.player.skills[JOB_SKILL[job.jobId]].level,
  };
}

/**
 * Nimmt das Angebot an. Ohne erfuellte Anforderungen kein Rang-Sprung; die
 * Stufenhistorie der alten Stufe bleibt in `totalShifts` erhalten, die
 * Stufen-Zaehler starten neu.
 */
export function promoteJob(world: WorldState): JobPromotionView {
  const view = jobPromotionView(world);
  if (view === null) throw new Error('Dieser Job hat keine weitere Karrierestufe.');
  if (!view.available) throw new Error(`Aufstieg nicht moeglich: ${view.blockReason}.`);
  const job = world.player.job;
  if (job === null) throw new Error('Du hast keinen Job.');
  const next = nextJobRank(job);
  if (next === null) throw new Error('Dieser Job hat keine weitere Karrierestufe.');
  job.rank = next.index;
  job.rankShifts = 0;
  job.rankQuality = 0;
  const text = `Befoerdert: ${next.label}. Lohn und Schichtdauer folgen der neuen Stufe.`;
  world.lastEvent = text;
  recordJournal(world, {
    kind: 'SYSTEM', subject: next.label, cause: 'Belegte Leistung im Job', effect: text, refs: {},
  });
  return { ...view, available: false, blockReason: 'Neue Stufe begonnen.' };
}
