/** @test-target: src/core/sim/narrative/choices/eligibility.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  availableChoices, checkChoiceSelection, choiceCostTotal, createEventCandidate, scheduleEvent,
  templateFor, type ChoiceContext, type EventTemplate,
} from '../narrative/scheduler';
import type { NarrativeEventInstance } from '../narrative/event-types';
import type { TriggerMatch } from '../narrative/trigger-types';
import { createWorld } from '../templates';

const template = templateFor('VISITOR_RETURN', 1)!;
const match: TriggerMatch = {
  triggerId: 'visitor-returned', matched: true, factId: 4, participants: ['visitor:2'], reasons: ['TEST'],
};

function fixture(activeTemplate: EventTemplate = template) {
  const world = createWorld('SMALL');
  const candidate = createEventCandidate(activeTemplate, { ...match, triggerId: activeTemplate.triggerId })!;
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0)!;
  const context: ChoiceContext = {
    tick: 0,
    flags: { startpool: 3 },
    houseBalance: 1000,
    relationships: [],
    participants: event.participants,
  };
  return { world, template: activeTemplate, event, context };
}

const withChoiceIds = (event: NarrativeEventInstance, choiceIds: readonly string[]): NarrativeEventInstance => ({
  ...event, offeredChoiceIds: choiceIds,
});

describe('Narrative Choice Eligibility', () => {
  it('akzeptiert nur angebotene, lebende Choices und liefert Anzeige-Kandidaten', () => {
    const { template: activeTemplate, event, context } = fixture();
    expect(checkChoiceSelection(event, activeTemplate, 'WELCOME_BACK', context)).toMatchObject({
      available: true, reasons: [],
    });
    expect(checkChoiceSelection(event, activeTemplate, 'NOT_A_CHOICE', context).reasons)
      .toContain('CHOICE_NOT_OFFERED');
    expect(availableChoices(event, activeTemplate, context).map((choice) => choice.choiceId))
      .toEqual(['WELCOME_BACK', 'ASK_ABOUT_LAST_VISIT']);
  });

  it('prueft Requirements bei jedem Klick erneut', () => {
    const { template: activeTemplate, event, context } = fixture();
    const withoutFlag = { ...context, flags: {} };
    const blocked = checkChoiceSelection(event, activeTemplate, 'ASK_ABOUT_LAST_VISIT', withoutFlag);
    expect(blocked.available).toBe(false);
    expect(blocked.reasons).toContain('REQUIREMENT_NOT_MET');
    expect(checkChoiceSelection(event, activeTemplate, 'ASK_ABOUT_LAST_VISIT', context).available).toBe(true);
  });

  it('weist abgelaufene und bereits beendete Events ab', () => {
    const { template: activeTemplate, event, context } = fixture();
    expect(checkChoiceSelection({ ...event, expiresTick: 0 }, activeTemplate, 'WELCOME_BACK', context).reasons)
      .toContain('EVENT_EXPIRED');
    const resolved = { ...event, status: 'RESOLVED' as const };
    expect(checkChoiceSelection(resolved, activeTemplate, 'WELCOME_BACK', context).reasons)
      .toContain('EVENT_NOT_LIVE');
  });

  it('prueft Template-Version und Kosten gegen den Live-Kontext', () => {
    const { template: activeTemplate, event, context } = fixture();
    expect(checkChoiceSelection({ ...event, templateVersion: 2 }, activeTemplate, 'WELCOME_BACK', context).reasons)
      .toContain('TEMPLATE_MISMATCH');
    const costTemplate: EventTemplate = {
      ...activeTemplate,
      eventId: 'COST_EVENT',
      choices: [{ ...activeTemplate.choices[0]!, costs: [{ kind: 'VACOIN', amount: 50 }] }],
    };
    const costFixture = fixture(costTemplate);
    expect(choiceCostTotal(costFixture.template.choices[0]!)).toBe(50);
    expect(checkChoiceSelection(costFixture.event, costFixture.template, 'WELCOME_BACK', {
      ...costFixture.context, houseBalance: 49,
    }).reasons).toContain('INSUFFICIENT_FUNDS');
    expect(checkChoiceSelection(costFixture.event, costFixture.template, 'WELCOME_BACK', {
      ...costFixture.context, houseBalance: 50,
    }).available).toBe(true);
  });

  it('prueft nur den persistierten Choice-Satz, nicht nachtraeglich ergaenzte IDs', () => {
    const { template: activeTemplate, event, context } = fixture();
    expect(checkChoiceSelection(withChoiceIds(event, []), activeTemplate, 'WELCOME_BACK', context).available)
      .toBe(false);
    expect(checkChoiceSelection(withChoiceIds(event, ['WELCOME_BACK']), activeTemplate, 'ASK_ABOUT_LAST_VISIT', context).available)
      .toBe(false);
  });
});
