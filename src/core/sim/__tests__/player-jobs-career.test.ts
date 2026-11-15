/** @test-target: src/core/sim/player-jobs.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { acceptJob, checkPromotion, completeJobTask, promote, quitJob, requestJobTask, averagePerformance } from '../player-jobs';
import { createWorld } from '../templates';
import { newPlayerRpg } from '../player-rpg';
import { grantSkillXp, newPlayerSkills } from '../player-skills';
import type { WorldState } from '../types';

function cleanWorld(): WorldState {
  const world = createWorld('SMALL');
  world.player.skills = newPlayerSkills();
  world.player.rpg = newPlayerRpg();
  return world;
}

function requestAndComplete(world: WorldState): void {
  const started = requestJobTask(world);
  expect(started.started).toBe(true);
  // Deterministic: always succeed, never injured
  completeJobTask(world, { nextFloat: () => 0.01 } as never);
}

describe('Karriereleitern (Issue #803)', () => {
  it('beginnt jeden neuen Job auf Rang 1 (Anfänger)', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    expect(world.player.job!.careerRank).toBe(1);
    expect(world.player.job!.performanceHistory).toEqual([]);
  });

  it('leistungsbewertung wird nach abgeschlossener Schicht aufgezeichnet', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    requestAndComplete(world);
    expect(world.player.job!.performanceHistory).toHaveLength(1);
    expect(world.player.job!.performanceHistory[0]).toBeGreaterThanOrEqual(0);
    expect(world.player.job!.performanceHistory[0]).toBeLessThanOrEqual(100);
  });

  it('Anfänger kann nicht befördert werden (fehlende Voraussetzungen)', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    requestAndComplete(world);
    const check = checkPromotion(world);
    expect(check.promotable).toBe(false);
    expect(check.reason).toBeDefined();
  });

  it('erfahrene Arbeitskraft mit genug Arbeitstagen, Skill und Performance wird befördert', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    grantSkillXp(world.player.skills, 'cleaning', 300);
    world.player.job!.workDays = 10;
    world.player.job!.performanceHistory = [90, 90, 90, 90, 90];
    const check = checkPromotion(world);
    expect(check.promotable).toBe(true);
    expect(check.nextRank).toBe(2);
  });

  it('schlechte Performance blockiert Beförderung', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    grantSkillXp(world.player.skills, 'cleaning', 300);
    world.player.job!.workDays = 10;
    world.player.job!.performanceHistory = [0, 0, 0, 0, 0];
    const check = checkPromotion(world);
    expect(check.promotable).toBe(false);
    expect(check.reason).toContain('Leistung');
  });

  it('gute Performance ermöglicht Beförderung', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    grantSkillXp(world.player.skills, 'cleaning', 300);
    world.player.job!.workDays = 10;
    world.player.job!.performanceHistory = [80, 80, 80, 80, 80];
    const check = checkPromotion(world);
    expect(check.promotable).toBe(true);
  });

  it('Beförderung erhöht den Rang und ändert das Event', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    grantSkillXp(world.player.skills, 'cleaning', 300);
    world.player.job!.workDays = 10;
    world.player.job!.performanceHistory = [90, 90, 90, 90, 90];
    const result = promote(world);
    expect(result.ok).toBe(true);
    expect(world.player.job!.careerRank).toBe(2);
    expect(result.notice).toContain('Vorarbeiter');
  });

  it('durchschnittliche Performance wird korrekt berechnet', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    world.player.job!.performanceHistory = [60, 80, 100];
    expect(averagePerformance(world.player.job!)).toBe(80);
  });

  it('Kündigung setzt Job auf null', () => {
    const world = cleanWorld();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    expect(world.player.job).not.toBeNull();
    quitJob(world);
    expect(world.player.job).toBeNull();
  });
});
