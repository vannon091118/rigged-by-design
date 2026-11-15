/**
 * Schichtbewertung (#803): Leistung aus echten Messwerten, keine erfundenen.
 *
 * Bewertet werden nur Groessen, die beim Abschluss wirklich vorliegen: die
 * passende Fach-Skill, der Koerperzustand aus den Spielerbeduerfnissen und eine
 * Verletzung, die in genau dieser Schicht passiert ist. Die Bewertung ist eine
 * reine Funktion und schreibt nichts.
 */
import { JOB_SKILL } from './job-career';
import { normalizePlayerNeeds, playerCondition } from './player-needs';
import type { PlayerJobState, WorldState } from './types';

type ShiftGrade = 'SCHLECHT' | 'SOLIDE' | 'GUT';

interface ShiftEvaluation {
  /** 0..100; Grundlage der Aufstiegsanforderung. */
  readonly quality: number;
  readonly grade: ShiftGrade;
  /** Jede Zeile nennt den Messwert, der die Punkte traegt. */
  readonly reasons: readonly string[];
  readonly injured: boolean;
}

const clampQuality = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

const gradeOf = (quality: number): ShiftGrade => (quality >= 70 ? 'GUT' : quality >= 50 ? 'SOLIDE' : 'SCHLECHT');

/** Bewertet die gerade abgeschlossene Schicht eines aktiven Jobs. */
export function evaluateShift(world: WorldState, job: PlayerJobState, injured: boolean): ShiftEvaluation {
  const skillId = JOB_SKILL[job.jobId];
  const level = world.player.skills[skillId].level;
  const condition = playerCondition(normalizePlayerNeeds(world.player.needs));
  const skillPoints = Math.min(40, Math.max(0, level - 1) * 5);
  const conditionPoints = Math.round((condition.workXpFactor - 1) * 40);
  const injuryPenalty = injured ? 20 : 0;
  const quality = clampQuality(40 + skillPoints + conditionPoints - injuryPenalty);
  return {
    quality,
    grade: gradeOf(quality),
    injured,
    reasons: [
      `Fach-Skill ${skillId} Stufe ${level}: +${skillPoints}`,
      `Koerperzustand ${condition.workXpFactor.toFixed(2)}: ${conditionPoints >= 0 ? '+' : ''}${conditionPoints}`,
      injured ? 'Verletzung in dieser Schicht: -20' : 'ohne Verletzung',
    ],
  };
}
