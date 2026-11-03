/** @test-target: src/core/sim/narrative/choices/contract.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  createEventCandidate, isEventTemplate, offerChoiceIds, resolveOfferedChoice, scheduleEvent,
  templateFor, type EventTemplate,
} from '../narrative/scheduler';
import type { TriggerMatch } from '../narrative/trigger-types';
import { createWorld } from '../templates';

const template = templateFor('VISITOR_RETURN', 1)!;
const match: TriggerMatch = {
  triggerId: 'visitor-returned', matched: true, factId: 9, participants: ['visitor:3'], reasons: ['TEST'],
};

function fixture() {
  const world = createWorld('SMALL');
  const event = scheduleEvent(world, createEventCandidate(template, match)!, 'OFFERED', 0)!;
  return { world, event };
}

describe('Narrative Choice Contract', () => {
  it('persistiert Template-ID, Version und den angebotenen Choice-Satz', () => {
    const { event } = fixture();
    expect(event.templateId).toBe('VISITOR_RETURN');
    expect(event.templateVersion).toBe(1);
    expect(event.offeredChoiceIds).toEqual(offerChoiceIds(template));
    expect(resolveOfferedChoice(template, event, 'WELCOME_BACK')?.choiceId).toBe('WELCOME_BACK');
  });

  it('weist unbekannte, nicht angebotene und versionsfremde Choices ab', () => {
    const { event } = fixture();
    expect(resolveOfferedChoice(template, event, 'UNKNOWN')).toBeNull();
    expect(resolveOfferedChoice(template, { ...event, offeredChoiceIds: [] }, 'WELCOME_BACK')).toBeNull();
    expect(resolveOfferedChoice({ ...template, version: 2 }, event, 'WELCOME_BACK')).toBeNull();
    expect(resolveOfferedChoice({ ...template, eventId: 'OTHER_EVENT' }, event, 'WELCOME_BACK')).toBeNull();
  });

  it('trennt Text-Slots von mechanischen Effekten', () => {
    const { event } = fixture();
    const renamed: EventTemplate = {
      ...template,
      contentSlots: template.contentSlots.map((slot) => (slot.kind === 'CHOICE_LABEL'
        ? { ...slot, id: `${slot.id}_TEXT` }
        : slot)),
      choices: template.choices.map((choice) => ({ ...choice, labelSlotId: `${choice.labelSlotId}_TEXT` })),
    };
    const before = resolveOfferedChoice(template, event, 'WELCOME_BACK');
    const after = resolveOfferedChoice(renamed, event, 'WELCOME_BACK');
    expect(isEventTemplate(renamed)).toBe(true);
    expect(after?.labelSlotId).not.toBe(before?.labelSlotId);
    expect(after?.effects).toEqual(before?.effects);
    expect(after?.outcomeId).toBe(before?.outcomeId);
  });
});
