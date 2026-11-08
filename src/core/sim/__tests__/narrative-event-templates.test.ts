/** @test-target: src/core/sim/narrative/scheduler.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  createEventCandidate, EVENT_TEMPLATES, isEventTemplate, resolveParticipants, templateFor,
  type EventTemplate,
} from '../narrative/scheduler';
import type { TriggerMatch } from '../narrative/trigger-types';
import type { ActorRef } from '../narrative/types';

const match = (triggerId: string, participants: readonly ActorRef[]): TriggerMatch => ({
  triggerId, matched: true, factId: 7, participants, reasons: ['TEST'],
});

describe('Narrative Event Templates', () => {
  it('registriert stabile Event-IDs und Versionen', () => {
    expect(EVENT_TEMPLATES.map((template) => `${template.eventId}@${template.version}`))
      .toEqual([
        'VISITOR_RETURN@1', 'VISITOR_CONFLICT@1', 'NEON_NACHT@1', 'TURNIER_ABEND@1',
        'RIVAL_MOVE@1', 'VISITOR_AFTERMATH@1', 'VISITOR_RETURN_WARM@1',
        'AMBIENT_BAR_TALK@1', 'AMBIENT_SHARED_ROUND@1', 'AMBIENT_TENSE_TABLE@1',
      ]);
    expect(templateFor('VISITOR_RETURN')?.choices.map((choice) => choice.choiceId))
      .toEqual(['WELCOME_BACK', 'ASK_ABOUT_LAST_VISIT']);
    expect(templateFor('VISITOR_RETURN', 2)).toBeNull();
  });

  it('haelt jede Event-ID ueber templateFor aufloesbar, auch fuer Engine-Demand', () => {
    for (const template of EVENT_TEMPLATES) {
      expect(templateFor(template.eventId, template.version)).toBe(template);
    }
    for (const eventId of ['NEON_NACHT', 'TURNIER_ABEND']) {
      const template = templateFor(eventId);
      expect(template?.triggerId).toBe('ENGINE_DEMAND');
      expect(template?.choices).toEqual([]);
      expect(template?.maxOccurrences).toBe(0);
    }
    for (const eventId of ['AMBIENT_BAR_TALK', 'AMBIENT_SHARED_ROUND', 'AMBIENT_TENSE_TABLE']) {
      const template = templateFor(eventId);
      expect(template?.triggerId).toBe('ENGINE_POOL');
      expect(template?.maxOccurrences).toBe(0);
    }
  });

  it('verwirft doppelte Choice-IDs, fremde Slots und falsche Rollen', () => {
    const template = templateFor('VISITOR_RETURN', 1)!;
    const duplicate: EventTemplate = { ...template, choices: [template.choices[0]!, template.choices[0]!] };
    const missingSlot: EventTemplate = {
      ...template,
      choices: [{ ...template.choices[0]!, labelSlotId: 'MISSING_SLOT' }],
    };
    const wrongRole: EventTemplate = { ...template, participantRoles: ['staff'] };
    const zeroCost: EventTemplate = {
      ...template,
      choices: [{ ...template.choices[0]!, costs: [{ kind: 'VACOIN', amount: 0 }] }],
    };
    expect(isEventTemplate(duplicate)).toBe(false);
    expect(isEventTemplate(missingSlot)).toBe(false);
    expect(isEventTemplate(wrongRole)).toBe(false);
    expect(isEventTemplate(zeroCost)).toBe(false);
    expect(isEventTemplate(template)).toBe(true);
  });

  it('loest Visitor- und Paar-Teilnehmer rollengenau auf', () => {
    const visitor = createEventCandidate(templateFor('VISITOR_RETURN', 1)!, match('visitor-returned', ['visitor:4']));
    expect(visitor?.participants).toEqual(['visitor:4']);
    expect(visitor?.offeredChoiceIds).toEqual(['WELCOME_BACK', 'ASK_ABOUT_LAST_VISIT']);
    expect(visitor?.templateVersion).toBe(1);
    expect(resolveParticipants(['visitor', 'visitor'], ['visitor:2', 'visitor:1']))
      .toEqual(['visitor:2', 'visitor:1']);
    expect(resolveParticipants(['visitor', 'visitor'], ['visitor:1', 'visitor:1'])).toBeNull();
  });

  it('traegt die Slot-Zwecke der neun Templates', () => {
    const purpose = (eventId: string, slotId: string) =>
      templateFor(eventId)?.contentSlots.find((slot) => slot.id === slotId)?.requiredContexts;
    expect(purpose('VISITOR_RETURN', 'CHOICE_WELCOME')).toEqual(['return', 'welcome']);
    expect(purpose('VISITOR_RETURN', 'CHOICE_ASK')).toEqual(['return', 'ask']);
    expect(purpose('VISITOR_CONFLICT', 'CHOICE_DEFUSE')).toEqual(['conflict', 'defuse']);
    expect(purpose('RIVAL_MOVE', 'CHOICE_CONFRONT')).toEqual(['rival', 'confront']);
    expect(purpose('NEON_NACHT', 'BODY')).toEqual(['demand']);
    expect(purpose('VISITOR_AFTERMATH', 'TITLE')).toEqual(['aftermath']);
    expect(purpose('VISITOR_AFTERMATH', 'CHOICE_LISTEN')).toEqual(['aftermath']);
  });

  it('weist falsche Trigger und nicht passende Teilnehmer ab', () => {
    const template = templateFor('VISITOR_RETURN', 1)!;
    expect(createEventCandidate(template, match('other-trigger', ['visitor:4']))).toBeNull();
    expect(createEventCandidate(template, match('visitor-returned', ['staff:1']))).toBeNull();
    expect(createEventCandidate({ ...template, eventId: 'lowercase' }, match('visitor-returned', ['visitor:4'])))
      .toBeNull();
  });
});
