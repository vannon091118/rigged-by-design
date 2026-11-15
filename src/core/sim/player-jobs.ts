/** Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. */

import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { PORTEMONNAIE, EXTERNAL } from './money';
import { getRival, type RivalId } from './rivals';
import { grantGlobalXp, injuryDurationReduction, luckInjuryFactor } from './player-rpg';
import { grantSkillXp, skillLevel, type PlayerSkillId } from './player-skills';
import { normalizePlayerNeeds, playerCondition } from './player-needs';
import { recordJournal } from './journal';
import type { PlayerJobState, WorldState, PlayerJobId } from './types';

const TICKS_PER_TASK = { CLEANER: 30, BARTENDER: 45, CARD_DEALER: 60, MECHANIC: 90 } as const;
const QUEUE_CAPACITY = { CLEANER: 3, BARTENDER: 2, CARD_DEALER: 1, MECHANIC: 2 } as const;
const XP_PER_TASK = { CLEANER: 8, BARTENDER: 12, CARD_DEALER: 15, MECHANIC: 20 } as const;
const DAILY_WAGE_VC = { CLEANER: 3, BARTENDER: 5, CARD_DEALER: 8, MECHANIC: 12 } as const;
const INJURY_CHANCE = { CLEANER: 0, BARTENDER: 0.05, CARD_DEALER: 0, MECHANIC: 0.1 } as const;
const JOB_XP_SOURCE: Record<PlayerJobId, string> = {
  CLEANER: 'JOB_CLEANER', BARTENDER: 'JOB_BARTENDER', CARD_DEALER: 'JOB_CARD_DEALER', MECHANIC: 'JOB_MECHANIC',
} as const;

const JOB_TO_SKILL: Record<PlayerJobId, 'cleaning' | 'service' | 'cardDealing' | 'repair'> = {
  CLEANER: 'cleaning', BARTENDER: 'service', CARD_DEALER: 'cardDealing', MECHANIC: 'repair',
} as const;

interface JobCareerRanks {
  readonly ranks: number;
  readonly rankLabels: string[];
  readonly wageMultiplier: number[];
  readonly requiredSkill: Record<PlayerSkillId, number>[];
  readonly requiredWorkDays: number[];
  readonly requiredPerformance: number[];
}

const CAREER_RANKS: Record<PlayerJobId, JobCareerRanks> = {
  CLEANER: {
    ranks: 2,
    rankLabels: ['Reinigungskraft', 'Vorarbeiter'],
    wageMultiplier: [1.0, 1.4],
    requiredSkill: [{ cleaning: 1, service: 0, cardDealing: 0, repair: 0 }, { cleaning: 3, service: 0, cardDealing: 0, repair: 0 }],
    requiredWorkDays: [0, 10],
    requiredPerformance: [0, 70],
  },
  BARTENDER: {
    ranks: 2,
    rankLabels: ['Barkeeper', 'Schichtleitung'],
    wageMultiplier: [1.0, 1.5],
    requiredSkill: [{ cleaning: 0, service: 1, cardDealing: 0, repair: 0 }, { cleaning: 0, service: 3, cardDealing: 0, repair: 0 }],
    requiredWorkDays: [0, 10],
    requiredPerformance: [0, 70],
  },
  CARD_DEALER: {
    ranks: 2,
    rankLabels: ['Croupier', 'Tischleitung'],
    wageMultiplier: [1.0, 1.6],
    requiredSkill: [{ cleaning: 0, service: 0, cardDealing: 1, repair: 0 }, { cleaning: 0, service: 0, cardDealing: 3, repair: 0 }],
    requiredWorkDays: [0, 10],
    requiredPerformance: [0, 70],
  },
  MECHANIC: {
    ranks: 2,
    rankLabels: ['Automaten-Mechaniker', 'Senior-Techniker'],
    wageMultiplier: [1.0, 1.7],
    requiredSkill: [{ cleaning: 0, service: 0, cardDealing: 0, repair: 1 }, { cleaning: 0, service: 0, cardDealing: 0, repair: 3 }],
    requiredWorkDays: [0, 10],
    requiredPerformance: [0, 70],
  },
};

const INJURY_TICKS = 120;
const BAR_PURCHASE_COST_VC = 50;
export { BAR_PURCHASE_COST_VC };

export const JOB_DEFS: Record<PlayerJobId, {
  readonly id: PlayerJobId; readonly label: string; readonly rivalId: RivalId;
  readonly dailyWageVC: number; readonly baseXpPerTask: number; readonly xpSourceKey: string;
  readonly injuryChance: number; readonly taskDurationTicks: number;
  readonly queueCapacity: number; readonly description: string;
  readonly careerRanks: JobCareerRanks;
}> = {
  CLEANER: { id: 'CLEANER', label: 'Reinigungskraft', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.CLEANER, baseXpPerTask: XP_PER_TASK.CLEANER,
    xpSourceKey: JOB_XP_SOURCE.CLEANER, injuryChance: INJURY_CHANCE.CLEANER,
    taskDurationTicks: TICKS_PER_TASK.CLEANER, queueCapacity: QUEUE_CAPACITY.CLEANER,
    careerRanks: CAREER_RANKS.CLEANER,
    description: 'Flecken entfernen, Gäste begrüßen. Trainiert: Wahrnehmung, Speed, Ausdauer.' },
  BARTENDER: { id: 'BARTENDER', label: 'Barkeeper', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.BARTENDER, baseXpPerTask: XP_PER_TASK.BARTENDER,
    xpSourceKey: JOB_XP_SOURCE.BARTENDER, injuryChance: INJURY_CHANCE.BARTENDER,
    taskDurationTicks: TICKS_PER_TASK.BARTENDER, queueCapacity: QUEUE_CAPACITY.BARTENDER,
    careerRanks: CAREER_RANKS.BARTENDER,
    description: 'Drinks zapfen, Streit schlichten. Trainiert: Charisma, Brawl, Wahrnehmung, Ausdauer.' },
  CARD_DEALER: { id: 'CARD_DEALER', label: 'Croupier', rivalId: 'GOLDENE_HAND',
    dailyWageVC: DAILY_WAGE_VC.CARD_DEALER, baseXpPerTask: XP_PER_TASK.CARD_DEALER,
    xpSourceKey: JOB_XP_SOURCE.CARD_DEALER, injuryChance: INJURY_CHANCE.CARD_DEALER,
    taskDurationTicks: TICKS_PER_TASK.CARD_DEALER, queueCapacity: QUEUE_CAPACITY.CARD_DEALER,
    careerRanks: CAREER_RANKS.CARD_DEALER,
    description: 'Karten geben, Wetten managen. Trainiert: Technik, Speed, Glück, Wahrnehmung.' },
  MECHANIC: { id: 'MECHANIC', label: 'Automaten-Mechaniker', rivalId: 'NEBELPALAST',
    dailyWageVC: DAILY_WAGE_VC.MECHANIC, baseXpPerTask: XP_PER_TASK.MECHANIC,
    xpSourceKey: JOB_XP_SOURCE.MECHANIC, injuryChance: INJURY_CHANCE.MECHANIC,
    taskDurationTicks: TICKS_PER_TASK.MECHANIC, queueCapacity: QUEUE_CAPACITY.MECHANIC,
    careerRanks: CAREER_RANKS.MECHANIC,
    description: 'Automaten reparieren, Hochspannung. Trainiert: Technik, Brawl, Ausdauer, Wahrnehmung.' },
};

export function acceptJob(world: WorldState, rivalId: RivalId, jobId: PlayerJobId): void {
  if (world.player.job !== null) throw new Error('Du hast bereits einen Job. Kündige zuerst.');
  const def = JOB_DEFS[jobId];
  if (def.rivalId !== rivalId) throw new Error(`Dieser Job gibt es nicht im Casino von ${getRival(rivalId).name}.`);
  const rival = getRival(rivalId);
  const station = rival.jobStations.find((s) => s.jobId === jobId);
  if (!station) throw new Error(`Keine Arbeitsstation für ${jobId} im ${rival.name} gefunden.`);
  world.player.job = { jobId, rivalId, stationId: station.id, currentTask: null, workDays: 0, lastPaidDay: world.day, lastWorkDay: 0, careerRank: 1, performanceHistory: [] };
  world.lastEvent = `Job angenommen: ${def.label} in ${rival.name}.`;
}

export function quitJob(world: WorldState): void {
  if (world.player.job === null) throw new Error('Du hast keinen Job.');
  const jobId = world.player.job.jobId;
  const def = JOB_DEFS[jobId];
  world.player.job = null;
  world.lastEvent = `Job gekündigt: ${def.label}.`;
}

export function requestJobTask(world: WorldState): { started: boolean; queuePosition: number } {
  const job = world.player.job;
  if (job === null) throw new Error('Du hast keinen Job. Nimm zuerst einen Job an.');
  if (job.currentTask !== null) throw new Error('Du arbeitest bereits an einer Aufgabe.');
  const def = JOB_DEFS[job.jobId];
  job.currentTask = {
    stationId: job.stationId,
    taskType: job.jobId === 'CLEANER' ? 'CLEAN' : job.jobId === 'BARTENDER' ? 'SERVE'
      : job.jobId === 'CARD_DEALER' ? 'DEAL' : 'REPAIR',
    ticksElapsed: 0, ticksTotal: def.taskDurationTicks,
  };
  return { started: true, queuePosition: -1 };
}

export function completeJobTask(world: WorldState, prng: { nextFloat: () => number }): void {
  const job = world.player.job;
  if (job === null || job.currentTask === null) return;
  const def = JOB_DEFS[job.jobId];
  const taskCondition = playerCondition(normalizePlayerNeeds(world.player.needs));
  grantGlobalXp(world.player.rpg, def.xpSourceKey, Math.max(1, Math.round(def.baseXpPerTask * taskCondition.workXpFactor)));
  grantSkillXp(world.player.skills, JOB_TO_SKILL[job.jobId], Math.max(1, Math.round(def.baseXpPerTask * taskCondition.workXpFactor)));
  const injuryChance = def.injuryChance * luckInjuryFactor(world.player.rpg) * taskCondition.injuryFactor;
  const injured = injuryChance > 0 && prng.nextFloat() < injuryChance;
  if (injured) {
    const reduction = injuryDurationReduction(world.player.rpg);
    world.player.rpg.injuryTicks = Math.max(1, INJURY_TICKS - reduction);
    world.player.rpg.hp = Math.max(1, world.player.rpg.hp - 5);
  }
  job.currentTask = null;
  job.workDays += 1;
  job.lastWorkDay = world.day;

  // Performance-Bewertung: 0-100 basierend auf Zustand, Skill und Verletzung
  const perfCondition = playerCondition(normalizePlayerNeeds(world.player.needs));
  const skill = skillLevel(world.player.skills, JOB_TO_SKILL[def.id]);
  const rpg = world.player.rpg;
  let performance = 50; // Basis
  performance += Math.round(20 * perfCondition.workXpFactor); // Zustand bis +20
  performance += Math.round(10 * Math.min(skill / 5, 1)); // Skill bis +10
  performance += Math.round(10 * Math.min(rpg.techniqueLevel / 5, 1)); // Technik bis +10
  if (injured) performance -= 20; // Verletzung -20
  performance = Math.max(0, Math.min(100, performance));
  job.performanceHistory.push(performance);
  // Nur die letzten 5 Schichten behalten
  if (job.performanceHistory.length > 5) job.performanceHistory.shift();

  world.lastEvent = injured
    ? `Schicht beendet: ${def.label}. Leicht verletzt bei der Arbeit. (Leistung ${performance})`
    : `Schicht beendet: ${def.label}. (Leistung ${performance})`;
}

/**
 * Durchschnittliche Performance der letzten abgeschlossenen Schichten.
 */
export function averagePerformance(job: PlayerJobState): number {
  if (job.performanceHistory.length === 0) return 0;
  const sum = job.performanceHistory.reduce((a, b) => a + b, 0);
  return sum / job.performanceHistory.length;
}

/**
 * Prüft ob eine Beförderung möglich ist: Rang hat noch Stufen, genug Arbeitstage,
 * erforderlicher Skill und ausreichende Performance.
 */
export function checkPromotion(world: WorldState): { promotable: boolean; reason?: string; nextRank?: number } {
  const job = world.player.job;
  if (job === null) return { promotable: false, reason: 'Kein Job aktiv.' };
  const def = JOB_DEFS[job.jobId];
  const ranks = CAREER_RANKS[def.id];
  if (job.careerRank >= ranks.ranks) return { promotable: false, reason: 'Bereits最高ster Rang.' };
  const next = job.careerRank; // 1-based index into arrays
  const reqSkill = ranks.requiredSkill[next];
  const reqWorkDays = ranks.requiredWorkDays[next] ?? 0;
  const reqPerf = ranks.requiredPerformance[next] ?? 0;

  for (const [skillId, minLevel] of Object.entries(reqSkill ?? {})) {
    if (skillLevel(world.player.skills, skillId as PlayerSkillId) < minLevel) {
      return { promotable: false, reason: `Fach-Skill ${skillId} Stufe ${minLevel} nicht erreicht.` };
    }
  }
  if (job.workDays < reqWorkDays) {
    return { promotable: false, reason: `Mindestens ${reqWorkDays} Arbeitstage erforderlich (aktuell ${job.workDays}).` };
  }
  if (averagePerformance(job) < reqPerf) {
    return { promotable: false, reason: `Durchschnittliche Leistung ${reqPerf} erforderlich (aktuell ${averagePerformance(job).toFixed(0)}).` };
  }
  return { promotable: true, nextRank: job.careerRank + 1 };
}

/**
 * Führt eine Beförderung durch: Rang erhöhen, Lohn anpassen, Ereignis protokollieren.
 */
export function promote(world: WorldState): { ok: boolean; notice: string } {
  const check = checkPromotion(world);
  if (!check.promotable) {
    return { ok: false, notice: check.reason ?? 'Beförderung nicht möglich.' };
  }
  const job = world.player.job!;
  const def = JOB_DEFS[job.jobId];
  const ranks = CAREER_RANKS[def.id];
  job.careerRank = check.nextRank!;
  const newLabel = ranks.rankLabels[job.careerRank - 1];
  const multiplier = ranks.wageMultiplier[Math.min(job.careerRank - 1, ranks.ranks - 1)] ?? 1.0;
  world.lastEvent = `Beförderung: ${def.label} → ${newLabel} (Rang ${job.careerRank}, Lohn ×${multiplier}).`;
  return {
    ok: true,
    notice: `Beförderung zu ${newLabel}! Dein Tageslohn steigt auf ×${multiplier}.`,
  };
}

/** Saves vor der Anwesenheitsregel tragen kein `lastWorkDay`: ohne Schicht kein rueckwirkender Lohn. */
export function hydrateJobState(job: PlayerJobState): PlayerJobState {
  return {
    ...job,
    lastWorkDay: Number.isFinite(job.lastWorkDay) ? job.lastWorkDay : 0,
    careerRank: Number.isFinite(job.careerRank) && job.careerRank >= 1 ? job.careerRank : 1,
    performanceHistory: Array.isArray(job.performanceHistory) ? job.performanceHistory : [],
  };
}

export function payDailyWage(
  world: WorldState,
  ledger: { transfer: (from: string, to: string, amount: VaCoinMicro, reason: string, tick: number) => void },
  prng: { nextFloat: () => number },
  tick: number,
): boolean {
  const job = world.player.job;
  if (job === null) return false;
  if (job.lastPaidDay >= world.day) return false;
  // Lohn gibt es nur fuer eine abgeschlossene Schicht: der Tageslohn des Vortags wird
  // am Tageswechsel ausgezahlt, wer nicht gearbeitet hat bekommt nichts und auch nichts nachtraeglich.
  if (job.lastWorkDay < world.day - 1) return false;
  const def = JOB_DEFS[job.jobId];
  const ranks = CAREER_RANKS[def.id];
  const multiplier = ranks.wageMultiplier[Math.min(job.careerRank - 1, ranks.ranks - 1)] ?? 1.0;
  const wage = fromVC(Math.round(def.dailyWageVC * multiplier));
  ledger.transfer(EXTERNAL, PORTEMONNAIE, wage, `tageslohn ${def.id} (Rang ${job.careerRank})`, tick);
  job.lastPaidDay = world.day;
  const wageCondition = playerCondition(normalizePlayerNeeds(world.player.needs));
  const injuryChance = def.injuryChance * luckInjuryFactor(world.player.rpg) * wageCondition.injuryFactor;
  if (injuryChance > 0 && prng.nextFloat() < injuryChance) {
    const reduction = injuryDurationReduction(world.player.rpg);
    world.player.rpg.injuryTicks = Math.max(1, INJURY_TICKS - reduction);
    world.player.rpg.hp = Math.max(1, world.player.rpg.hp - 10);
    world.lastEvent = `Schwer verletzt bei der Arbeit: ${def.label}!`;
  }
  return true;
}

export function buyBar(
  world: WorldState,
  ledger: { getBalance: (account: string) => VaCoinMicro; transfer: (from: string, to: string, amount: VaCoinMicro, reason: string, tick: number) => void },
  tick: number,
): void {
  if (world.player.barPurchased) throw new Error('Du hast bereits eine Bude.');
  const cost = fromVC(BAR_PURCHASE_COST_VC);
  if (ledger.getBalance(PORTEMONNAIE) < cost) throw new Error(`Nicht genug Bargeld. Benötigt: ${BAR_PURCHASE_COST_VC} VC.`);
  ledger.transfer(PORTEMONNAIE, EXTERNAL, cost, 'bude kaufen', tick);
  world.player.barPurchased = true;
  world.lastEvent = 'Deine erste Bude gekauft!';
  recordJournal(world, { kind: 'SYSTEM', subject: 'BAR', cause: 'Erster Kauf', effect: world.lastEvent, refs: {} });
}
