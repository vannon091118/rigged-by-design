/**
 * Beförderung im Spielerjob: Durchschnitt der letzten Schichten, Anforderungen
 * der nächsten Stufe und der eigentliche Aufstieg. Reine Ableitung aus dem
 * gespeicherten Jobzustand und den Jobleitern aus `player-job-defs.ts`;
 * `player-jobs.ts` re-exportiert die drei Funktionen, damit alle Aufrufer
 * unverändert bleiben.
 */
import { careerRanksOf, JOB_DEFS } from './player-job-defs';
import { skillLevel, type PlayerSkillId } from './player-skills';
import type { PlayerJobState, WorldState } from './types';

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
  const ranks = careerRanksOf(def.id);
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
  const ranks = careerRanksOf(def.id);
  job.careerRank = check.nextRank!;
  const newLabel = ranks.rankLabels[job.careerRank - 1];
  const multiplier = ranks.wageMultiplier[Math.min(job.careerRank - 1, ranks.ranks - 1)] ?? 1.0;
  world.lastEvent = `Beförderung: ${def.label} → ${newLabel} (Rang ${job.careerRank}, Lohn ×${multiplier}).`;
  return {
    ok: true,
    notice: `Beförderung zu ${newLabel}! Dein Tageslohn steigt auf ×${multiplier}.`,
  };
}
