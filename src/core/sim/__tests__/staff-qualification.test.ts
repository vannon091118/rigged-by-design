/**
 * @test-target: src/core/sim/staff-qualification.ts
 * @error-code: ERR-2001
 *
 * Die Qualifikation ist eine Eigenschaft des Agenten, nicht der Rolle: gleiche
 * Rolle mit unterschiedlicher Stufe muss unterschiedlich kosten und
 * unterschiedlich bewertet werden, und sie muss den Save ueberleben.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, mulVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { TICKS_PER_DAY } from '../clock';
import { HAUSKONTO } from '../money';
import { hireAgent, staffRoleWage } from '../staff';
import {
  qualificationForAgent, qualificationLabel, qualificationRank, qualificationWorkBonus,
  staffWage, STAFF_QUALIFICATION_RULES, type StaffQualification,
} from '../staff-qualification';
import { REVIEW_TICKS, staffPerformance } from '../staff-queries';
import { createWorld } from '../templates';
import { staffTick } from '../upkeep';
import { hydrateWorld } from '../../../store/migrate';
import { toSavedGame } from '../../../store/save';
import type { StaffAgent } from '../types';

const funded = (): Ledger => new Ledger({ HAUSKONTO: fromVC(500) });

describe('Qualifikationsstufe des Personals', () => {
  it('leitet die Stufe deterministisch aus der Agenten-ID ab', () => {
    expect(qualificationForAgent(1)).toBe(qualificationForAgent(1));
    expect(qualificationForAgent(1)).toBe('GESELLE');
    expect(qualificationForAgent(2)).toBe('MEISTER');
    expect(qualificationForAgent(3)).toBe('LEHRLING');
    expect(qualificationRank('MEISTER')).toBeGreaterThan(qualificationRank('LEHRLING'));
    expect(qualificationLabel('MEISTER')).toBe('Meister');
  });

  it('bezahlt dieselbe Rolle nach Stufe unterschiedlich', () => {
    const world = createWorld('SMALL');
    const base = staffRoleWage(world, 'cleaner');
    const lehrling = staffWage(base, 'LEHRLING');
    const geselle = staffWage(base, 'GESELLE');
    const meister = staffWage(base, 'MEISTER');
    expect(geselle).toBe(base);
    expect(lehrling).toBeLessThan(geselle);
    expect(meister).toBeGreaterThan(geselle);
    expect(meister).toBe(mulVC(base, STAFF_QUALIFICATION_RULES.MEISTER.wageBps));
  });

  it('bewertet gleiche Arbeit je nach Stufe anders', () => {
    const world = createWorld('SMALL');
    const agent = hireAgent(world, funded(), 'cleaner');
    agent.workTicks = REVIEW_TICKS.solid - 10;
    agent.qualification = 'LEHRLING';
    expect(staffPerformance([agent])).toBe('FRISCH');
    agent.qualification = 'MEISTER';
    expect(staffPerformance([agent])).toBe('SOLIDE');
    expect(qualificationWorkBonus('MEISTER')).toBeGreaterThan(qualificationWorkBonus('LEHRLING'));
  });

  it('bucht den Tageslohn aus der Stufe des Agenten', () => {
    const dailyDelta = (qualification: StaffQualification): number => {
      const world = createWorld('SMALL');
      const ledger = funded();
      const agent = hireAgent(world, ledger, 'guard');
      agent.qualification = qualification;
      world.tick = TICKS_PER_DAY;
      const before = ledger.getBalance(HAUSKONTO);
      staffTick(world, ledger, new Prng(randomSeed()));
      return before - ledger.getBalance(HAUSKONTO);
    };
    const guardWage = createWorld('SMALL').prices.guardWage;
    expect(dailyDelta('MEISTER') - dailyDelta('GESELLE')).toBe(mulVC(guardWage, 3_000));
  });

  it('erhaelt die Stufe ueber Save und Load', () => {
    const world = createWorld('SMALL');
    const ledger = funded();
    const agent = hireAgent(world, ledger, 'guard');
    agent.qualification = 'MEISTER';
    const saved = toSavedGame(world, ledger, 1);

    const loaded = createWorld('SMALL');
    hydrateWorld(loaded, saved);
    expect(loaded.agents.find((candidate) => candidate.id === agent.id)?.qualification).toBe('MEISTER');
  });

  it('alte Saves ohne Stufe bekommen die Stufe ihrer Agenten-ID', () => {
    const world = createWorld('SMALL');
    const ledger = funded();
    const agent = hireAgent(world, ledger, 'cleaner');
    const saved = toSavedGame(world, ledger, 1);
    const legacy = {
      ...saved,
      agents: saved.agents?.map((entry) => ({ ...entry, qualification: undefined })) as unknown as StaffAgent[],
    };

    const loaded = createWorld('SMALL');
    hydrateWorld(loaded, legacy);
    expect(loaded.agents[0]?.qualification).toBe(qualificationForAgent(agent.id));
  });
});
