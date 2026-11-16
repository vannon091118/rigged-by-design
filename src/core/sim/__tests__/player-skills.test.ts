/** @test-target: src/core/sim/player-skills.ts */
/** @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  grantSkillXp, newPlayerSkills, skillLevel, skillEffect, skillLabel, skillIdForSource,
  xpForNextLevel, type PlayerSkillId,
} from '../player-skills';

describe('Spieler-Fach-Skills: Learn-by-Doing', () => {
  it('initialisiert alle vier Fachrichtungen auf Stufe 1 mit 0 XP', () => {
    const skills = newPlayerSkills();
    expect(skillLevel(skills, 'cleaning')).toBe(1);
    expect(skillLevel(skills, 'service')).toBe(1);
    expect(skillLevel(skills, 'cardDealing')).toBe(1);
    expect(skillLevel(skills, 'repair')).toBe(1);
    expect(skills.cleaning.xp).toBe(0);
    expect(skills.service.xp).toBe(0);
    expect(skills.cardDealing.xp).toBe(0);
    expect(skills.repair.xp).toBe(0);
  });

  it('vergibt Skill-XP nur für positive Ganzzahlen', () => {
    const skills = newPlayerSkills();
    grantSkillXp(skills, 'cleaning', 0);
    grantSkillXp(skills, 'cleaning', -5);
    grantSkillXp(skills, 'cleaning', 3.5);
    expect(skillLevel(skills, 'cleaning')).toBe(1);
    expect(skills.cleaning.xp).toBe(0);
  });

  it('erzeugt reproduzierbaren Skillfortschritt für dieselbe Handlung', () => {
    const s1 = newPlayerSkills();
    const s2 = newPlayerSkills();
    grantSkillXp(s1, 'cleaning', 50);
    grantSkillXp(s2, 'cleaning', 50);
    expect(s1).toEqual(s2);
  });

  it('steigert die Stufe bei Erreichen der XP-Schwelle', () => {
    const skills = newPlayerSkills();
    grantSkillXp(skills, 'cleaning', 100);
    expect(skillLevel(skills, 'cleaning')).toBe(2);
    expect(skills.cleaning.xp).toBe(0);
  });

  it('trägt Rest-XP bei Mehrfachabschluss in die nächste Stufe über', () => {
    const skills = newPlayerSkills();
    grantSkillXp(skills, 'cleaning', 260);
    expect(skillLevel(skills, 'cleaning')).toBe(3);
    expect(skills.cleaning.xp).toBe(10);
  });

  it('verbindet jede Fachrichtung mit eindeutigen XP-Quellschlüsseln', () => {
    expect(skillIdForSource('CLEAN_FLOOR')).toBe('cleaning');
    expect(skillIdForSource('CLEAN_TILE')).toBe('cleaning');
    expect(skillIdForSource('DEEP_CLEANING')).toBe('cleaning');
    expect(skillIdForSource('SERVE_DRINK')).toBe('service');
    expect(skillIdForSource('CARD_DEAL')).toBe('cardDealing');
    expect(skillIdForSource('REPAIR_MACHINE')).toBe('repair');
    expect(skillIdForSource('REPAIR')).toBe('repair');
    expect(skillIdForSource('UNKNOWN_SOURCE')).toBeNull();
  });

  it('gibt für jede Fachrichtung eine konkrete In-Spiel-Wirkung zurück', () => {
    const cleaningL1 = skillEffect('cleaning', 1);
    const cleaningL3 = skillEffect('cleaning', 3);
    expect(cleaningL1).toContain('Reinigungsradius');
    expect(cleaningL3).toContain('+2 benachbarte');

    const serviceL1 = skillEffect('service', 1);
    const serviceL4 = skillEffect('service', 4);
    expect(serviceL1).toContain('Gaststimmung');
    expect(serviceL4).toContain('+15');

    const repairL1 = skillEffect('repair', 1);
    const repairL3 = skillEffect('repair', 3);
    expect(repairL1).toContain('Ersatzteilersparnis');
    expect(repairL3).toContain('jede 3.');

    const cardL1 = skillEffect('cardDealing', 1);
    const cardL5 = skillEffect('cardDealing', 5);
    expect(cardL1).not.toContain('Gewinnchance');
    expect(cardL1).toContain('Gaststimmung');
    expect(cardL5).toContain('Gaststimmung +4');
    expect(cardL5).toContain('Geduld +2');
  });

  it('gibt für jede Fachrichtung eine korrekte Bezeichnung zurück', () => {
    const labels: Record<PlayerSkillId, string> = {
      cleaning: 'Reinigung',
      service: 'Service / Bar',
      cardDealing: 'Kartengeben',
      repair: 'Reparieren',
    };
    for (const [id, expected] of Object.entries(labels)) {
      expect(skillLabel(id as PlayerSkillId)).toBe(expected);
    }
  });

  it('definiert die XP-Schwelle linear wachsend', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(150);
    expect(xpForNextLevel(3)).toBe(200);
    expect(xpForNextLevel(10)).toBe(550);
  });
});
