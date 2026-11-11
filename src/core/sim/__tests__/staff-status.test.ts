/**
 * @test-target: src/core/sim/staff-queries.ts
 * @error-code: ERR-2001
 *
 * Der Personalstatus lebt ausschliesslich in den Agenten: ohne Agent keine
 * Wirkung, ein steckender Agent keine Wirkung, und die Reichweite entscheidet
 * statt der Einstellung allein.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { TICKS_PER_DAY } from '../demand';
import { HAUSKONTO } from '../money';
import { hireAgent, tickAgents } from '../staff';
import {
  agentsInRange, getStaffAvailability, getStaffCoverage, hasActiveGuard, hasStaff,
  REVIEW_TICKS, staffPerformance,
} from '../staff-queries';
import { createWorld } from '../templates';
import { staffTick } from '../upkeep';

const fundedLedger = (): Ledger => new Ledger({ HAUSKONTO: fromVC(500) });

describe('Personalstatus aus den Agenten', () => {
  it('ohne Guard-Agent gibt es keine Guard-Wirkung und keinen Guard-Lohn', () => {
    const world = createWorld('SMALL');
    const point = { x: 5, y: 5 };
    expect(hasStaff(world, 'guard')).toBe(false);
    expect(hasActiveGuard(world)).toBe(false);
    expect(getStaffAvailability(world, 'guard')).toBe('ABWESEND');
    expect(getStaffCoverage(world, 'guard', point, 6)).toBe(false);
    expect(agentsInRange(world, point, 6, 'guard')).toBe(0);

    // Der Tagessatz faellt nur fuer Rollen mit Agenten an.
    const dailyDelta = (hire: boolean): number => {
      const worldOfRun = createWorld('SMALL');
      const ledger = fundedLedger();
      if (hire) hireAgent(worldOfRun, ledger, 'guard');
      worldOfRun.tick = TICKS_PER_DAY;
      const before = ledger.getBalance(HAUSKONTO);
      staffTick(worldOfRun, ledger, new Prng(randomSeed()));
      return before - ledger.getBalance(HAUSKONTO);
    };
    const guardWage = createWorld('SMALL').prices.guardWage;
    expect(dailyDelta(true) - dailyDelta(false)).toBe(guardWage);
  });

  it('ein blockierter Guard bleibt eingestellt, wirkt aber nicht', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    guard.x = 5;
    guard.y = 5;
    const point = { x: 6, y: 5 };
    expect(hasActiveGuard(world)).toBe(true);
    expect(getStaffCoverage(world, 'guard', point, 6)).toBe(true);

    guard.blockedReason = 'Streit nicht erreichbar';
    expect(hasStaff(world, 'guard')).toBe(true);
    expect(hasActiveGuard(world)).toBe(false);
    expect(getStaffAvailability(world, 'guard')).toBe('INAKTIV');
    expect(getStaffCoverage(world, 'guard', point, 6)).toBe(false);
    expect(agentsInRange(world, point, 6, 'guard')).toBe(0);
  });

  it('die Reichweite entscheidet, nicht die Einstellung', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    guard.x = 10;
    guard.y = 10;
    const near = { x: 15, y: 10 };
    const far = { x: 17, y: 10 };
    expect(getStaffCoverage(world, 'guard', near, 6)).toBe(true);
    expect(getStaffCoverage(world, 'guard', far, 6)).toBe(false);
    expect(agentsInRange(world, near, 6, 'guard')).toBe(1);
    expect(agentsInRange(world, far, 6, 'guard')).toBe(0);

    guard.task = 'toDispute';
    expect(getStaffAvailability(world, 'guard')).toBe('BESCHAEFTIGT');
    expect(hasActiveGuard(world)).toBe(true);
  });
});

describe('Leistungsbewertung aus geleisteter Arbeit', () => {
  const runTicks = (world: ReturnType<typeof createWorld>, ledger: Ledger, ticks: number): void => {
    const prng = new Prng(randomSeed());
    for (let i = 0; i < ticks; i += 1) tickAgents(world, ledger, prng);
  };

  it('waechst mit echter Arbeit im Agenten-Tick von FRISCH ueber SOLIDE zu STARK', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    expect(staffPerformance([guard])).toBe('FRISCH');
    runTicks(world, fundedLedger(), REVIEW_TICKS.solid);
    expect(staffPerformance([guard])).toBe('SOLIDE');
    runTicks(world, fundedLedger(), REVIEW_TICKS.stark - REVIEW_TICKS.solid);
    expect(staffPerformance([guard])).toBe('STARK');
  });

  it('ein steckender Agent kann nicht stark sein, auch mit vielen Arbeits-Ticks', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    guard.workTicks = REVIEW_TICKS.stark * 10;
    expect(staffPerformance([guard])).toBe('STARK');
    guard.blockedReason = 'Streit nicht erreichbar';
    expect(staffPerformance([guard])).toBe('EINGESCHRAENKT');
  });

  it('bewertet mehrere Agenten gemeinsam und bleibt bei gleichem Zustand gleich', () => {
    const world = createWorld('SMALL');
    const ledger = fundedLedger();
    const first = hireAgent(world, ledger, 'porter');
    first.workTicks = REVIEW_TICKS.solid - 10;
    expect(staffPerformance([first])).toBe('FRISCH');
    const second = hireAgent(world, ledger, 'cleaner');
    second.workTicks = 10;
    // Zwei Agenten derselben Rolle zaehlen zusammen: 30 + 10 erreicht die Schwelle.
    expect(staffPerformance([first, second])).toBe('SOLIDE');
    expect(staffPerformance([first, second])).toBe('SOLIDE');
    expect(staffPerformance([])).toBe('FRISCH');
  });
});
