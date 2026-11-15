/**
 * @test-target: src/core/sim/staff-queries.ts
 * @error-code: ERR-2001
 *
 * Auftrag, Blockadegrund und Leistung sind gemeinsam aus dem Agentenbestand
 * abgeleitet: eine Sicht je Rolle statt drei verteilter Ableitungen. Kein
 * zweiter Staff-State — die Sicht liest nur world.agents.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { hireAgent } from '../staff';
import {
  AVAILABILITY_LABEL,
  PERFORMANCE_LABEL,
  TASK_LABEL,
} from '../../../ui/staff-labels';
import {
  REVIEW_TICKS,
  staffAssignmentView,
} from '../staff-queries';
import { createWorld } from '../templates';
import type { StaffAgent } from '../types';

const fundedLedger = (): Ledger => new Ledger({ HAUSKONTO: fromVC(500) });

describe('abgeleitete Staff-Sicht aus den Agenten', () => {
  it('meldet alle Rollen in fester Reihenfolge als abwesend in der leeren Welt', () => {
    const world = createWorld('SMALL');
    const view = staffAssignmentView(world);

    expect(view.map((entry) => entry.role)).toEqual(['guard', 'cleaner', 'bartender', 'cashier', 'porter']);
    for (const entry of view) {
      expect(entry.availability).toBe('ABWESEND');
      expect(entry.agents).toEqual([]);
      expect(entry.performance).toBe('FRISCH');
    }
  });

  it('zeigt Auftrag, Stufe und Dienst des eingestellten Guards', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    const view = staffAssignmentView(world);
    const entry = view.find((candidate) => candidate.role === 'guard')!;

    expect(entry.availability).toBe('VERFUEGBAR');
    expect(entry.agents).toHaveLength(1);
    expect(entry.agents[0]).toEqual({
      id: guard.id,
      task: 'idle',
      blockedReason: '',
      qualification: guard.qualification,
      onDuty: true,
    });
  });

  it('meldet einen arbeitenden Agenten als beschaeftigt mit sichtbarem Auftrag', () => {
    const world = createWorld('SMALL');
    const porter = hireAgent(world, fundedLedger(), 'porter');
    porter.task = 'serve';
    const view = staffAssignmentView(world);
    const entry = view.find((candidate) => candidate.role === 'porter')!;

    expect(entry.availability).toBe('BESCHAEFTIGT');
    expect(entry.agents[0]?.task).toBe('serve');
  });

  it('meldet Blockadegrund, Inaktivitaet und eingeschraenkte Leistung gemeinsam', () => {
    const world = createWorld('SMALL');
    const porter = hireAgent(world, fundedLedger(), 'porter');
    porter.blockedReason = 'Lager voll';
    const view = staffAssignmentView(world);
    const entry = view.find((candidate) => candidate.role === 'porter')!;

    expect(entry.availability).toBe('INAKTIV');
    expect(entry.performance).toBe('EINGESCHRAENKT');
    expect(entry.agents[0]?.blockedReason).toBe('Lager voll');
    expect(entry.agents[0]?.onDuty).toBe(false);
  });

  it('bewertet geleistete Arbeit ohne Stufenbonus an den Review-Schwellen', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    guard.qualification = 'LEHRLING';
    const entryOf = () => staffAssignmentView(world).find((candidate) => candidate.role === 'guard')!;

    guard.workTicks = REVIEW_TICKS.solid - 1;
    expect(entryOf().performance).toBe('FRISCH');
    guard.workTicks = REVIEW_TICKS.solid;
    expect(entryOf().performance).toBe('SOLIDE');
    guard.workTicks = REVIEW_TICKS.stark;
    expect(entryOf().performance).toBe('STARK');
  });

  it('zaehlt den Qualifikationsbonus zur geleisteten Arbeit', () => {
    const world = createWorld('SMALL');
    const guard = hireAgent(world, fundedLedger(), 'guard');
    guard.qualification = 'GESELLE';
    guard.workTicks = REVIEW_TICKS.solid - 25;
    const entry = staffAssignmentView(world).find((candidate) => candidate.role === 'guard')!;

    expect(entry.performance).toBe('SOLIDE');
    expect(entry.agents[0]?.qualification).toBe('GESELLE');
  });

  it('bewertet mehrere Agenten einer Rolle gemeinsam', () => {
    const world = createWorld('SMALL');
    const first = hireAgent(world, fundedLedger(), 'porter');
    first.qualification = 'LEHRLING';
    first.workTicks = 20;
    const second: StaffAgent = {
      id: 99, role: 'porter', x: 1, y: 1, path: [], pathIndex: 0,
      carryingCrate: null, workTicks: 20, task: 'idle',
      blockedReason: '', targetDisputeId: null, qualification: 'LEHRLING',
    };
    world.agents.push(second);
    const entry = staffAssignmentView(world).find((candidate) => candidate.role === 'porter')!;

    expect(entry.agents.map((agent) => agent.id)).toEqual([first.id, 99]);
    expect(entry.performance).toBe('SOLIDE');
    expect(entry.availability).toBe('VERFUEGBAR');
  });

  it('macht jeden Sichtwert ueber die gemeinsamen Klartext-Labels lesbar', () => {
    const world = createWorld('SMALL');
    const porter = hireAgent(world, fundedLedger(), 'porter');
    porter.task = 'toStorage';
    porter.blockedReason = 'Lager voll';
    const view = staffAssignmentView(world);

    for (const entry of view) {
      expect(AVAILABILITY_LABEL[entry.availability]).toBeTypeOf('string');
      expect(PERFORMANCE_LABEL[entry.performance]).toBeTypeOf('string');
      for (const agent of entry.agents) {
        expect(TASK_LABEL[agent.task]).toBeTypeOf('string');
      }
    }
    const entry = view.find((candidate) => candidate.role === 'porter')!;
    expect(AVAILABILITY_LABEL[entry.availability]).toBe('alle blockiert');
    expect(TASK_LABEL[entry.agents[0]!.task]).toBe('bringt Ersatzteile');
  });
});
