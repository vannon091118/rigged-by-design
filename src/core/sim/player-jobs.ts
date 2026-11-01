/** Spieler-Jobs in fremden Casinos. Sims-Style Arbeit an Job-Stationen. */

import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { HAUSKONTO, PORTEMONNAIE, EXTERNAL } from './money';
import { getRival, type RivalId } from './rivals';
import { grantGlobalXp, injuryDurationReduction } from './player-rpg';
import { recordJournal } from './journal';
import type { WorldState, PlayerJobId } from './types';

const TICKS_PER_TASK = { CLEANER: 30, BARTENDER: 45, CARD_DEALER: 60, MECHANIC: 90 } as const;
const QUEUE_CAPACITY = { CLEANER: 3, BARTENDER: 2, CARD_DEALER: 1, MECHANIC: 2 } as const;
const XP_PER_TASK = { CLEANER: 8, BARTENDER: 12, CARD_DEALER: 15, MECHANIC: 20 } as const;
const DAILY_WAGE_VC = { CLEANER: 3, BARTENDER: 5, CARD_DEALER: 8, MECHANIC: 12 } as const;
const INJURY_CHANCE = { CLEANER: 0, BARTENDER: 0.05, CARD_DEALER: 0, MECHANIC: 0.1 } as const;
const JOB_XP_SOURCE: Record<PlayerJobId, string> = {
  CLEANER: 'JOB_CLEANER', BARTENDER: 'JOB_BARTENDER', CARD_DEALER: 'JOB_CARD_DEALER', MECHANIC: 'JOB_MECHANIC',
} as const;
const INJURY_TICKS = 120;
const BAR_PURCHASE_COST_VC = 50;
export { BAR_PURCHASE_COST_VC };

export const JOB_DEFS: Record<PlayerJobId, {
  readonly id: PlayerJobId; readonly label: string; readonly rivalId: RivalId;
  readonly dailyWageVC: number; readonly baseXpPerTask: number; readonly xpSourceKey: string;
  readonly injuryChance: number; readonly taskDurationTicks: number;
  readonly queueCapacity: number; readonly description: string;
}> = {
  CLEANER: { id: 'CLEANER', label: 'Reinigungskraft', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.CLEANER, baseXpPerTask: XP_PER_TASK.CLEANER,
    xpSourceKey: JOB_XP_SOURCE.CLEANER, injuryChance: INJURY_CHANCE.CLEANER,
    taskDurationTicks: TICKS_PER_TASK.CLEANER, queueCapacity: QUEUE_CAPACITY.CLEANER,
    description: 'Flecken entfernen, Gäste begrüßen. Trainiert: Wahrnehmung, Speed, Ausdauer.' },
  BARTENDER: { id: 'BARTENDER', label: 'Barkeeper', rivalId: 'HAFENKLAUSE',
    dailyWageVC: DAILY_WAGE_VC.BARTENDER, baseXpPerTask: XP_PER_TASK.BARTENDER,
    xpSourceKey: JOB_XP_SOURCE.BARTENDER, injuryChance: INJURY_CHANCE.BARTENDER,
    taskDurationTicks: TICKS_PER_TASK.BARTENDER, queueCapacity: QUEUE_CAPACITY.BARTENDER,
    description: 'Drinks zapfen, Streit schlichten. Trainiert: Charisma, Brawl, Wahrnehmung, Ausdauer.' },
  CARD_DEALER: { id: 'CARD_DEALER', label: 'Croupier', rivalId: 'GOLDENE_HAND',
    dailyWageVC: DAILY_WAGE_VC.CARD_DEALER, baseXpPerTask: XP_PER_TASK.CARD_DEALER,
    xpSourceKey: JOB_XP_SOURCE.CARD_DEALER, injuryChance: INJURY_CHANCE.CARD_DEALER,
    taskDurationTicks: TICKS_PER_TASK.CARD_DEALER, queueCapacity: QUEUE_CAPACITY.CARD_DEALER,
    description: 'Karten geben, Wetten managen. Trainiert: Technik, Speed, Glück, Wahrnehmung.' },
  MECHANIC: { id: 'MECHANIC', label: 'Automaten-Mechaniker', rivalId: 'NEBELPALAST',
    dailyWageVC: DAILY_WAGE_VC.MECHANIC, baseXpPerTask: XP_PER_TASK.MECHANIC,
    xpSourceKey: JOB_XP_SOURCE.MECHANIC, injuryChance: INJURY_CHANCE.MECHANIC,
    taskDurationTicks: TICKS_PER_TASK.MECHANIC, queueCapacity: QUEUE_CAPACITY.MECHANIC,
    description: 'Automaten reparieren, Hochspannung. Trainiert: Technik, Brawl, Ausdauer, Wahrnehmung.' },
};

export function acceptJob(world: WorldState, rivalId: RivalId, jobId: PlayerJobId): void {
  if (world.player.job !== null) throw new Error('Du hast bereits einen Job. Kündige zuerst.');
  const def = JOB_DEFS[jobId];
  if (def.rivalId !== rivalId) throw new Error(`Dieser Job gibt es nicht im Casino von ${getRival(rivalId).name}.`);
  const rival = getRival(rivalId);
  const station = rival.jobStations.find((s) => s.jobId === jobId);
  if (!station) throw new Error(`Keine Arbeitsstation für ${jobId} im ${rival.name} gefunden.`);
  world.player.job = { jobId, rivalId, stationId: station.id, currentTask: null, workDays: 0, lastPaidDay: world.day };
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
  grantGlobalXp(world.player.rpg, def.xpSourceKey, Math.floor(def.baseXpPerTask / 2));
  return { started: true, queuePosition: -1 };
}

export function completeJobTask(world: WorldState, prng: { nextFloat: () => number }): void {
  const job = world.player.job;
  if (job === null || job.currentTask === null) return;
  const def = JOB_DEFS[job.jobId];
  grantGlobalXp(world.player.rpg, def.xpSourceKey, def.baseXpPerTask);
  if (def.injuryChance > 0 && prng.nextFloat() < def.injuryChance / 10) {
    const reduction = injuryDurationReduction(world.player.rpg);
    world.player.rpg.injuryTicks = Math.max(1, INJURY_TICKS - reduction);
    world.player.rpg.hp = Math.max(1, world.player.rpg.hp - 5);
    world.lastEvent = `Leicht verletzt bei der Arbeit: ${def.label}.`;
  }
  job.currentTask = null;
  job.workDays += 1;
  world.lastEvent = `Schicht beendet: ${def.label}.`;
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
  const def = JOB_DEFS[job.jobId];
  const wage = fromVC(def.dailyWageVC);
  ledger.transfer(HAUSKONTO, PORTEMONNAIE, wage, `tageslohn ${def.id}`, tick);
  job.lastPaidDay = world.day;
  if (def.injuryChance > 0 && prng.nextFloat() < def.injuryChance) {
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
