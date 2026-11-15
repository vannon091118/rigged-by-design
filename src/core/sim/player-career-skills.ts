/**
 * Spieler-Karriere: Fach-Skills-Ansicht.
 *
 * Gibt die vier Fach-Skills mit Level, XP und in-Spiel-Wirkung fuer das
 * Charakterfenster zurueck. Getrennt von player-career.ts, damit die Hot-Zone
 * Datei unter dem Logik-Budget bleibt.
 */

import type { WorldState } from './types';
import { skillLabel, skillEffect, xpForNextLevel, type PlayerSkillId } from './player-skills';

export interface CareerSkill {
  readonly id: PlayerSkillId;
  readonly label: string;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly effect: string;
}

/** Alle vier Fach-Skills des Spielers als Karriere-Ansicht. */
export function careerSkills(world: WorldState): readonly CareerSkill[] {
  return (['cleaning', 'service', 'cardDealing', 'repair'] as const).map((id) => {
    const skill = world.player.skills[id];
    return {
      id,
      label: skillLabel(id),
      level: skill.level,
      xp: skill.xp,
      xpToNext: Math.max(0, xpForNextLevel(skill.level) - skill.xp),
      effect: skillEffect(id, skill.level),
    };
  });
}
