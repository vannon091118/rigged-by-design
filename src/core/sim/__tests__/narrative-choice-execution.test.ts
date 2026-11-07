/** @test-target: src/core/sim/narrative/commands/execute.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { templateFor } from '../narrative/events/definitions';
import { relationshipBetween } from '../narrative/relationships';
import { scheduleEvent } from '../narrative/event-scheduler';
import { executeChoice } from '../narrative/commands/execute';
import type { EventTemplate } from '../narrative/events/template-types';
import type { TriggerMatch } from '../narrative/trigger-types';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

const template = templateFor('VISITOR_RETURN', 1)!;

function fixture(activeTemplate: EventTemplate = template, status: 'OFFERED' | 'ACTIVE' = 'ACTIVE') {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Test', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned', matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['TEST'],
  };
  const candidate = createEventCandidate(activeTemplate, match)!;
  const event = scheduleEvent(world, candidate, status, 0)!;
  return { world, ledger, visitor, event };
}

describe('Narrative Choice Execution', () => {
  it('fuehrt genau eine Choice aus und persistiert das Outcome', () => {
    const { world, ledger, event } = fixture();
    const entries = ledger.entryCount;
    const result = executeChoice(world, ledger, event.id, 'WELCOME_BACK');
    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('RESOLVED');
    expect(result.event?.resolution).toBe('WELCOMED');
    expect(relationshipBetween(world, 'visitor:1', 'player')?.sympathy).toBe(1);
    expect(ledger.entryCount).toBe(entries);
    expect(ledger.verifyIncremental()).toBe(true);
  });

  it('aktiviert ein OFFERED-Event vor der Aufloesung', () => {
    const { world, ledger, event } = fixture(template, 'OFFERED');
    const result = executeChoice(world, ledger, event.id, 'WELCOME_BACK');
    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('RESOLVED');
  });

  it('ist bei wiederholtem Klick idempotent und veraendert keine Werte erneut', () => {
    const { world, ledger, event } = fixture();
    expect(executeChoice(world, ledger, event.id, 'WELCOME_BACK').ok).toBe(true);
    const entries = ledger.entryCount;
    const second = executeChoice(world, ledger, event.id, 'WELCOME_BACK');
    expect(second.ok).toBe(false);
    expect(second.rejections.map((entry) => entry.reason)).toContain('EVENT_NOT_LIVE');
    expect(ledger.entryCount).toBe(entries);
    expect(relationshipBetween(world, 'visitor:1', 'player')?.sympathy).toBe(1);
    expect(world.narrative.pending.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });

  it('weist unbekannte Choices ohne Weltmutation ab', () => {
    const { world, ledger, event } = fixture();
    const result = executeChoice(world, ledger, event.id, 'UNKNOWN');
    expect(result.ok).toBe(false);
    expect(result.rejections.map((entry) => entry.reason)).toContain('CHOICE_NOT_OFFERED');
    expect(world.narrative.flags).toEqual({});
    expect(relationshipBetween(world, 'visitor:1', 'player')).toBeNull();
    expect(world.narrative.pending.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });

  it('bucht deklarierte Kosten einmal und haelt die Ledger-Integritaet', () => {
    const costTemplate: EventTemplate = {
      ...template,
      eventId: 'COST_VISITOR_RETURN',
      choices: [{
        ...template.choices[0]!,
        choiceId: 'PAY_WELCOME',
        costs: [{ kind: 'VACOIN', amount: 5000 }],
      }],
    };
    const { world, ledger, event } = fixture(costTemplate);
    const entries = ledger.entryCount;
    const result = executeChoice(world, ledger, event.id, 'PAY_WELCOME', costTemplate);
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(5000);
    expect(ledger.getBalance(HAUSKONTO)).toBe(fromVC(100) - 5000);
    expect(ledger.entryCount).toBe(entries + 1);
    expect(ledger.verifyIncremental()).toBe(true);
  });

  it('verlaengert eine lebende Frist ueber FREEZE_TICK', () => {
    const freezeTemplate: EventTemplate = {
      ...template,
      eventId: 'FREEZE_VISITOR_RETURN',
      choices: [{
        ...template.choices[0]!,
        choiceId: 'FREEZE_WELCOME',
        effects: [{ kind: 'FREEZE_TICK', ticks: 10 }],
      }],
    };
    const { world, ledger, event } = fixture(freezeTemplate);
    const result = executeChoice(world, ledger, event.id, 'FREEZE_WELCOME', freezeTemplate);
    expect(result.ok).toBe(true);
    expect(result.event?.expiresTick).toBe(event.expiresTick + 10);
    expect(result.event?.status).toBe('RESOLVED');
  });
});
