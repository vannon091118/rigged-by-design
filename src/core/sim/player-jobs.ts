/** Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. */

import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { PORTEMONNAIE, EXTERNAL } from './money';
import { getRival, type RivalId } from './rivals';
import { grantGlobalXp, injuryDurationReduction, luckInjuryFactor } from './player-rpg';
import { grantSkillXp } from './player-skills';
import { normalizePlayerNeeds, playerCondition } from './player-needs';
import { recordJournal } from './journal';
import { JOB_DEFS, JOB_TO_SKILL, JOB_XP_SOURCE } from './job-defs';
import { jobPromotionView, jobTaskTicks, jobWageVC } from './job-career';
import { evaluateShift } from './job-performance';
import type { PlayerJobState, WorldState, PlayerJobId } from './types';

export { JOB_DEFS } from './job-defs';

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
  world.player.job = {
    jobId, rivalId, stationId: station.id, currentTask: null, workDays: 0, lastPaidDay: world.day, lastWorkDay: 0,
    rank: 0, rankShifts: 0, rankQuality: 0, lastQuality: null, totalShifts: 0,
  };
  world.lastEvent = `Job angenommen: ${def.label} in ${rival.name}. Einstiegsstufe.`;
}

export function quitJob(world: WorldState): void {
  if (world.player.job === null) throw new Error('Du hast keinen Job.');
  const def = JOB_DEFS[world.player.job.jobId];
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
    ticksElapsed: 0, ticksTotal: jobTaskTicks(def.taskDurationTicks, job),
  };
  return { started: true, queuePosition: -1 };
}

export function completeJobTask(world: WorldState, prng: { nextFloat: () => number }): void {
  const job = world.player.job;
  if (job === null || job.currentTask === null) return;
  const def = JOB_DEFS[job.jobId];
  const condition = playerCondition(normalizePlayerNeeds(world.player.needs));
  grantGlobalXp(world.player.rpg, JOB_XP_SOURCE[job.jobId], Math.max(1, Math.round(def.baseXpPerTask * condition.workXpFactor)));
  grantSkillXp(world.player.skills, JOB_TO_SKILL[job.jobId], Math.max(1, Math.round(def.baseXpPerTask * condition.workXpFactor)));
  const injuryChance = def.injuryChance * luckInjuryFactor(world.player.rpg) * condition.injuryFactor;
  const injured = injuryChance > 0 && prng.nextFloat() < injuryChance;
  if (injured) {
    const reduction = injuryDurationReduction(world.player.rpg);
    world.player.rpg.injuryTicks = Math.max(1, INJURY_TICKS - reduction);
    world.player.rpg.hp = Math.max(1, world.player.rpg.hp - 5);
  }
  const evaluation = evaluateShift(world, job, injured);
  job.currentTask = null;
  job.workDays += 1;
  job.rankShifts += 1;
  job.rankQuality += evaluation.quality;
  job.totalShifts += 1;
  job.lastQuality = evaluation.quality;
  job.lastWorkDay = world.day;
  const promotion = jobPromotionView(world);
  const offer = promotion?.available ? ' Aufstieg moeglich: Angebot an der Station pruefen.' : '';
  world.lastEvent = `Schicht beendet: ${def.label}. Qualitaet ${evaluation.quality} (${evaluation.grade}).`
    + `${injured ? ' Leicht verletzt bei der Arbeit.' : ''}${offer}`;
}

/**
 * Saves vor der Anwesenheitsregel tragen kein `lastWorkDay`: ohne Schicht kein
 * rueckwirkender Lohn. Saves vor der Karriere tragen keinen Rang und keine
 * Stufen-Zaehler; sie starten in Stufe 0, ohne erfundene Leistung nachzutragen.
 */
export function hydrateJobState(job: PlayerJobState): PlayerJobState {
  const workDays = Number.isFinite(job.workDays) ? job.workDays : 0;
  return {
    ...job,
    lastWorkDay: Number.isFinite(job.lastWorkDay) ? job.lastWorkDay : 0,
    rank: Number.isInteger(job.rank) && job.rank >= 0 ? job.rank : 0,
    rankShifts: Number.isFinite(job.rankShifts) ? job.rankShifts : 0,
    rankQuality: Number.isFinite(job.rankQuality) ? job.rankQuality : 0,
    lastQuality: Number.isFinite(job.lastQuality) ? job.lastQuality : null,
    totalShifts: Number.isFinite(job.totalShifts) ? job.totalShifts : workDays,
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
  const wage = fromVC(jobWageVC(def.dailyWageVC, job));
  ledger.transfer(EXTERNAL, PORTEMONNAIE, wage, `tageslohn ${def.id} stufe ${job.rank}`, tick);
  job.lastPaidDay = world.day;
  const condition = playerCondition(normalizePlayerNeeds(world.player.needs));
  const injuryChance = def.injuryChance * luckInjuryFactor(world.player.rpg) * condition.injuryFactor;
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
