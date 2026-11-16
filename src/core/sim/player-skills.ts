/**
 * Spieler-Fach-Skills: Learn-by-Doing-Fortschritt aus echten Handlungen.
 *
 * Getrennt von den sieben RPG-Attributen (player-rpg.ts). Fach-Skills bilden
 * die tatsächlich ausgeübten Tätigkeiten ab: Reinigen, Service/Bar,
 * Kartengeben, Reparieren. Jede abgeschlossene Handlung vergibt Skill-XP,
 * abgebrochene oder fehlgeschlagene Aktionen nicht. Skill-Stufen haben eine
 * konkrete In-Spiel-Wirkung für die zugehörige Tätigkeit.
 */

export type PlayerSkillId = 'cleaning' | 'service' | 'cardDealing' | 'repair';

export interface SkillProgression {
  level: number;
  xp: number;
  /** Nur für 'repair': zählt durchgeführte Reparaturen für die kostenlose N-te Reparatur. */
  repairCount?: number;
}

export interface PlayerSkillState {
  cleaning: SkillProgression;
  service: SkillProgression;
  cardDealing: SkillProgression;
  repair: SkillProgression;
}

export function newPlayerSkills(): PlayerSkillState {
  return {
    cleaning: { level: 1, xp: 0 },
    service: { level: 1, xp: 0 },
    cardDealing: { level: 1, xp: 0 },
    repair: { level: 1, xp: 0, repairCount: 0 },
  };
}

/** XP für die nächste Stufe; wächst linear mit der aktuellen Stufe. */
const XP_PER_LEVEL_BASE = 100;
const XP_PER_LEVEL_GROWTH = 50;

export function xpForNextLevel(level: number): number {
  return XP_PER_LEVEL_BASE + (level - 1) * XP_PER_LEVEL_GROWTH;
}

/** Skill-XP nach einer erfolgreich abgeschlossenen Handlung gutschreiben.
 *  Nur wenn amount eine positive Ganzzahl ist; sonst kein Fortschritt. */
export function grantSkillXp(
  skills: PlayerSkillState,
  skillId: PlayerSkillId,
  amount: number,
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  const skill = skills[skillId];
  skill.xp += amount;
  while (skill.xp >= xpForNextLevel(skill.level)) {
    skill.xp -= xpForNextLevel(skill.level);
    skill.level += 1;
  }
}

export function skillLevel(skills: PlayerSkillState, skillId: PlayerSkillId): number {
  return skills[skillId].level;
}

/** Klartext-Wirkung einer Stufe für die Anzeige im Charakterfenster. */
export function skillEffect(skillId: PlayerSkillId, level: number): string {
  switch (skillId) {
    case 'cleaning':
      return `Reinigungsradius +${level - 1} benachbarte Kacheln pro Handgriff`;
    case 'service':
      return `Gaststimmung +${(level - 1) * 5} pro serviertem Drink`;
    case 'cardDealing':
      return `Gaststimmung +${level - 1}, Geduld +${Math.ceil((level - 1) / 2)} pro Tischrunde`;
    case 'repair':
      return `Ersatzteilersparnis: jede ${level}. Reparatur verbraucht kein Teil`;
    default:
      return '';
  }
}

/** Zentrale Zuordnung von XP-Quellschlüsseln zu Fach-Skills.
 *  Jede Quelle darf nur einem Skill zugeordnet sein (keine doppelte Anrechnung). */
export const SKILL_XP_SOURCES: Readonly<Record<string, PlayerSkillId>> = {
  CLEAN_FLOOR: 'cleaning',
  CLEAN_TILE: 'cleaning',
  DEEP_CLEANING: 'cleaning',
  SERVE_DRINK: 'service',
  CARD_DEAL: 'cardDealing',
  REPAIR_MACHINE: 'repair',
  REPAIR: 'repair',
} as const;

/** Prüft, ob ein XP-Quellschlüssel einem Fach-Skill zugeordnet ist. */
export function skillIdForSource(sourceKey: string): PlayerSkillId | null {
  return (SKILL_XP_SOURCES as Record<string, PlayerSkillId | null>)[sourceKey] ?? null;
}

/** Etikette für die Anzeige im Charakterfenster. */
export function skillLabel(skillId: PlayerSkillId): string {
  switch (skillId) {
    case 'cleaning': return 'Reinigung';
    case 'service': return 'Service / Bar';
    case 'cardDealing': return 'Kartengeben';
    case 'repair': return 'Reparieren';
    default: return skillId;
  }
}
