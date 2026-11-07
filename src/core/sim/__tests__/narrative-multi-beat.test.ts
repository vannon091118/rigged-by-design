/** @test-target: src/core/sim/narrative/commands/execute.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { choicesForStep } from '../narrative/choices/steps';
import { executeChoice } from '../narrative/commands/execute';
import { scheduleEvent } from '../narrative/event-scheduler';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { isEventTemplate } from '../narrative/events/template-schema';
import type { EventTemplate } from '../narrative/events/template-types';
import type { TriggerMatch } from '../narrative/trigger-types';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

const BASE = {
  costs: [] as const,
  effects: [] as const,
  followUpEventId: null,
  requirements: [] as const,
};

/** Zwei Beats: erst fragen oder gehen, im zweiten Beat antworten oder warten. */
const template: EventTemplate = {
  eventId: 'MULTI_BEAT_PROBE',
  version: 1,
  triggerId: 'visitor-returned',
  priority: 10,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY' },
    { id: 'ASK', kind: 'CHOICE_LABEL' },
    { id: 'LOOK', kind: 'CHOICE_LABEL' },
    { id: 'LEAVE', kind: 'CHOICE_LABEL' },
    { id: 'ANSWER', kind: 'CHOICE_LABEL' },
    { id: 'AFTER', kind: 'OUTCOME' },
  ],
  choices: [
    {
      ...BASE,
      choiceId: 'ASK',
      labelSlotId: 'ASK',
      outcomeId: 'ASKED',
      nextStep: 'PROBE',
      requirements: [{ op: 'event-step', step: 'START' }],
    },
    {
      ...BASE,
      choiceId: 'LOOK',
      labelSlotId: 'LOOK',
      outcomeId: 'LOOKED',
      nextStep: null,
      requirements: [{ op: 'event-step', step: 'START' }],
    },
    {
      ...BASE,
      choiceId: 'ANSWER',
      labelSlotId: 'ANSWER',
      outcomeId: 'ANSWERED',
      nextStep: null,
      requirements: [{ op: 'event-step', step: 'PROBE' }],
    },
    {
      ...BASE,
      choiceId: 'WAIT',
      labelSlotId: 'LEAVE',
      outcomeId: 'WAITED',
      nextStep: null,
      requirements: [{ op: 'event-step', step: 'PROBE' }],
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 10,
  maxOccurrences: 1,
};

function fixture(active: EventTemplate = template) {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Mira Test', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned',
    matched: true,
    factId: 1,
    participants: [`visitor:${visitor.id}`],
    reasons: ['TEST'],
  };
  const candidate = createEventCandidate(active, match)!;
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0)!;
  return { world, ledger, event };
}

describe('Narrative Multi-Beat Events', () => {
  it('akzeptiert nextStep und weist ein unerreichbares Ziel ab', () => {
    expect(isEventTemplate(template)).toBe(true);
    const unreachable: EventTemplate = {
      ...template,
      choices: [{
        ...template.choices[0]!,
        nextStep: 'NOWHERE',
        requirements: [{ op: 'event-step', step: 'START' }],
      }],
    };
    expect(isEventTemplate(unreachable)).toBe(false);
  });

  it('wechselt nach einer Beat-Choice den Schritt statt aufzuloesen', () => {
    const { world, ledger, event } = fixture();
    const result = executeChoice(world, ledger, event.id, 'ASK', template);
    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('ACTIVE');
    expect(result.event?.step).toBe('PROBE');
    expect(result.event?.resolution).toBeNull();
    expect(world.narrative.pending.some((entry) => entry.kind === 'EVENT_RESOLVED')).toBe(false);
  });

  it('zeigt pro Beat nur die dort angebotenen Optionen', () => {
    const { world, ledger, event } = fixture();
    expect(choicesForStep(template, event)).toEqual(['ASK', 'LOOK']);
    const advanced = executeChoice(world, ledger, event.id, 'ASK', template).event!;
    expect(choicesForStep(template, advanced)).toEqual(['ANSWER', 'WAIT']);
  });

  it('weist die Choice eines spaeteren Beats vor dem Wechsel ab', () => {
    const { world, ledger, event } = fixture();
    const result = executeChoice(world, ledger, event.id, 'ANSWER', template);
    expect(result.ok).toBe(false);
    expect(result.rejections.map((entry) => entry.reason)).toContain('REQUIREMENT_NOT_MET');
    expect(result.event?.step).toBe('START');
    expect(result.event?.status).toBe('ACTIVE');
    expect(world.narrative.flags).toEqual({});
  });

  it('loest erst im letzten Beat mit dem Outcome auf', () => {
    const { world, ledger, event } = fixture();
    expect(executeChoice(world, ledger, event.id, 'ASK', template).ok).toBe(true);
    const result = executeChoice(world, ledger, event.id, 'ANSWER', template);
    expect(result.event?.status).toBe('RESOLVED');
    expect(result.event?.resolution).toBe('ANSWERED');
    expect(world.narrative.pending.at(-1)?.kind).toBe('EVENT_RESOLVED');
  });

  it('traegt sechzehn Slots und neun Choices ueber drei Beats', () => {
    const steps = ['START', 'PROBE', 'FINAL'];
    const wide: EventTemplate = {
      ...template,
      eventId: 'WIDE_MULTI_BEAT',
      contentSlots: [
        ...Array.from({ length: 9 }, (_, index) => ({ id: `LABEL_${index}`, kind: 'CHOICE_LABEL' as const })),
        ...Array.from({ length: 7 }, (_, index) => ({ id: `TEXT_${index}`, kind: 'BODY' as const })),
      ],
      choices: steps.flatMap((step, index) => [0, 1, 2].map((column) => ({
        ...BASE,
        choiceId: `C_${index}_${column}`,
        labelSlotId: `LABEL_${index * 3 + column}`,
        outcomeId: `OUT_${index}_${column}`,
        requirements: [{ op: 'event-step' as const, step }],
        nextStep: column === 0 ? steps[index + 1] ?? null : null,
      }))),
    };
    expect(wide.choices.length).toBe(9);
    expect(isEventTemplate(wide)).toBe(true);
    const candidate = createEventCandidate(wide, {
      triggerId: 'visitor-returned',
      matched: true,
      factId: 2,
      participants: ['visitor:1'],
      reasons: ['TEST'],
    });
    expect(candidate?.offeredChoiceIds?.length ?? 0).toBe(9);
  });
});
