/**
 * @test-target: src/core/sim/job-career.ts
 * @error-code: ERR-2001
 *
 * Karriereleitern: Leistung kommt aus echten Messwerten, der Aufstieg ist ein
 * Angebot mit belegten Anforderungen, und Rang wirkt auf Lohn und Schichtdauer.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Ledger } from '../../economy/ledger';
import { acceptJob, completeJobTask, hydrateJobState, payDailyWage, quitJob } from '../player-jobs';
import {
  jobAverageQuality, jobPromotionView, jobTaskTicks, jobWageVC, promoteJob,
} from '../job-career';
import { evaluateShift } from '../job-performance';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { createWorld } from '../templates';
import { replaySave, toSavedGame } from '../../../store/save';
import type { PlayerJobState, WorldState } from '../types';

function working(): WorldState {
  const world = createWorld('SMALL');
  acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
  return world;
}

function workShift(world: WorldState, float = 0.99): void {
  const job = world.player.job!;
  job.currentTask = { stationId: job.stationId, taskType: 'CLEAN', ticksElapsed: 0, ticksTotal: jobTaskTicks(30, job) };
  completeJobTask(world, { nextFloat: () => float });
}

describe('Job-Karriere (#803)', () => {
  it('bewertet eine Schicht besser, wenn die passende Fach-Skill hoeher ist', () => {
    const world = working();
    const job = world.player.job!;
    world.player.skills.cleaning.level = 1;
    const beginner = evaluateShift(world, job, false);
    world.player.skills.cleaning.level = 6;
    const experienced = evaluateShift(world, job, false);

    expect(experienced.quality).toBeGreaterThan(beginner.quality);
    expect(beginner.reasons).toHaveLength(3);
    expect(beginner.reasons.join(' ')).toContain('cleaning');
  });

  it('zieht eine Verletzung von derselben Schicht ab', () => {
    const world = working();
    const job = world.player.job!;
    expect(evaluateShift(world, job, true).quality).toBeLessThan(evaluateShift(world, job, false).quality);
  });

  it('schreibt eine abgeschlossene Schicht in die Stufenbilanz', () => {
    const world = working();
    workShift(world);
    const job = world.player.job!;

    expect(job.rankShifts).toBe(1);
    expect(job.totalShifts).toBe(1);
    expect(job.lastQuality).not.toBeNull();
    expect(jobAverageQuality(job)).toBeGreaterThan(0);
  });

  it('verweigert den Aufstieg mit konkretem Grund statt still zu springen', () => {
    const world = working();
    const view = jobPromotionView(world)!;

    expect(view.available).toBe(false);
    expect(view.requirements.map((entry) => entry.id)).toEqual(['shifts', 'quality', 'skill']);
    expect(view.blockReason).toContain('0/3');
    expect(() => promoteJob(world)).toThrow(/nicht moeglich/);
  });

  it('bietet den Aufstieg bei belegter Leistung an und veraendert Lohn und Dauer', () => {
    const world = working();
    const job = world.player.job!;
    job.rankShifts = 3;
    job.rankQuality = 210;
    world.player.skills.cleaning.level = 4;

    expect(jobWageVC(3, job)).toBe(3);
    expect(jobTaskTicks(30, job)).toBe(30);
    expect(jobPromotionView(world)!.available).toBe(true);

    promoteJob(world);

    expect(job.rank).toBe(1);
    expect(job.rankShifts).toBe(0);
    expect(jobWageVC(3, job)).toBe(5);
    expect(jobTaskTicks(30, job)).toBe(26);
    expect(jobPromotionView(world)).toBeNull();
  });

  it('bucht den Tageslohn ausschliesslich ueber den Ledger und in Hoehe des Rangs', () => {
    const world = working();
    const ledger = new Ledger();
    const job = world.player.job!;
    job.lastWorkDay = world.day;
    job.lastPaidDay = world.day - 1;
    const start = ledger.getBalance(PORTEMONNAIE);

    payDailyWage(world, ledger, { nextFloat: () => 0.99 }, world.tick);
    expect(ledger.getBalance(PORTEMONNAIE) - start).toBe(fromVC(3));

    job.rank = 1;
    job.lastPaidDay = world.day - 1;
    const afterRank = ledger.getBalance(PORTEMONNAIE);
    payDailyWage(world, ledger, { nextFloat: () => 0.99 }, world.tick);
    expect(ledger.getBalance(PORTEMONNAIE) - afterRank).toBe(fromVC(5));
    expect(ledger.getBalance(EXTERNAL)).toBeLessThan(0);
  });

  it('startet nach einem Arbeitgeberwechsel wieder in der Einstiegsstufe', () => {
    const world = working();
    world.player.job!.rank = 1;
    quitJob(world);
    acceptJob(world, 'HAFENKLAUSE', 'BARTENDER');

    expect(world.player.job!.rank).toBe(0);
    expect(world.player.job!.rankShifts).toBe(0);
    expect(world.player.job!.totalShifts).toBe(0);
  });

  it('erhaelt Rang und Stufenbilanz ueber Save und Load', () => {
    const world = working();
    const job = world.player.job!;
    job.rankShifts = 3;
    job.rankQuality = 210;
    world.player.skills.cleaning.level = 4;
    promoteJob(world);

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, new Ledger(), 42))))!;
    const restored = loaded.world.player.job!;

    expect(restored.rank).toBe(1);
    expect(restored.totalShifts).toBe(job.totalShifts);
    expect(restored.lastQuality).toBe(job.lastQuality);
  });

  it('liest alte Saves ohne Rang als Einstiegsstufe, ohne Leistung zu erfinden', () => {
    const legacy = {
      jobId: 'CLEANER', rivalId: 'HAFENKLAUSE', stationId: 'station_cleaner',
      currentTask: null, workDays: 4, lastPaidDay: 0, lastWorkDay: 0,
    } as unknown as PlayerJobState;
    const hydrated = hydrateJobState(legacy);

    expect(hydrated.rank).toBe(0);
    expect(hydrated.rankShifts).toBe(0);
    expect(hydrated.rankQuality).toBe(0);
    expect(hydrated.lastQuality).toBeNull();
    expect(hydrated.totalShifts).toBe(4);
  });
});
