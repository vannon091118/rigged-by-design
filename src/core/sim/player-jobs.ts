/** Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. */

import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { PORTEMONNAIE, EXTERNAL } from './money';
import { getRival, type RivalId } from './rivals';
import { grantGlobalXp, injuryDurationReduction, luckInjuryFactor } from './player-rpg';
import { grantSkillXp, skillLevel } from './player-skills';
import { normalizePlayerNeeds, playerCondition } from './player-needs';
import { recordJournal } from './journal';
import { careerRanksOf, JOB_DEFS, JOB_TO_SKILL } from './player-job-defs';
import type { PlayerJobState, WorldState, PlayerJobId } from './types';

export { JOB_DEFS } from './player-job-defs';
export { averagePerformance, checkPromotion, promote } from './player-job-promotion';

const INJURY_TICKS = 120;
const BAR_PURCHASE_COST_VC = 50;
export { BAR_PURCHASE_COST_VC };

export function acceptJob(world: WorldState, rivalId: RivalId, jobId: PlayerJobId): void {
  if (world.player.job !== null) throw new Error('Du hast bereits einen Job. Kündige zuerst.');
  const def = JOB_DEFS[jobId];
  if (def.rivalId !== rivalId) throw new Error(`Dieser Job gibt es nicht im Casino von ${getRival(rivalId).name}.`);
  const rival = getRival(rivalId);
  const station = rival.jobStations.find((s) => s.jobId === jobId);
  if (!station) throw new Error(`Keine Arbeitsstation für ${jobId} im ${rival.name} gefunden.`);
  world.player.job = { jobId, rivalId, stationId: station.id, currentTask: null, workDays: 0, lastPaidDay: world.day, lastWorkDay: 0, careerRank: 1, performanceHistory: [], appliedTo: null, offeredBy: null };
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
  const ranks = careerRanksOf(def.id);
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
