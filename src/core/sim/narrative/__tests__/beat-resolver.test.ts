/** @test-target: src/core/sim/narrative/choices/resolver.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { fromVC } from '../../../economy/vacoin';
import { HAUSKONTO } from '../../money';
import { createWorld } from '../../templates';
import { recordVisitor } from '../../visitors';
import { resolveBeatChoices, buildChoiceContext } from '../choices/resolver';
import { choicesForStep } from '../choices/steps';
import { advanceEventStep } from '../event-lifecycle';
import { scheduleEvent } from '../event-scheduler';
import { createEventCandidate } from '../events/template-candidate';
import type { EventTemplate } from '../events/template-types';
import type { TriggerMatch } from '../trigger-types';

const BASE = {
  costs: [] as const,
  effects: [] as const,
  followUpEventId: null,
  requirements: [] as const,
};

const template: EventTemplate = {
  eventId: 'RESOLVER_PROBE',
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
    { id: 'ANSWER', kind: 'CHOICE_LABEL' },
    { id: 'WAIT', kind: 'CHOICE_LABEL' },
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
      labelSlotId: 'WAIT',
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

function fixture() {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Mira Resolver', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned',
    matched: true,
    factId: 1,
    participants: [`visitor:${visitor.id}`],
    reasons: ['TEST'],
  };
  const candidate = createEventCandidate(template, match);
  if (!candidate) throw new Error('Kandidat fehlt');
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0);
  if (!event) throw new Error('Event fehlt');
  return { world, ledger, event };
}

describe('Narrative Beat Resolver', () => {
  it('vereint Beat-Filter und Eligibility in genau einer Ableitung', () => {
    const { world, ledger, event } = fixture();
    const resolved = resolveBeatChoices(world, ledger, event, template);
    expect(resolved.map((choice) => choice.choiceId)).toEqual(choicesForStep(template, event));
    expect(resolved.map((choice) => choice.choiceId)).toEqual(['ASK', 'LOOK']);
    expect(resolved.every((choice) => choice.available)).toBe(true);
    expect(resolved.every((choice) => choice.cost === 0)).toBe(true);
  });

  it('folgt dem Beat-Wechsel ohne zweiten Filterpfad', () => {
    const { world, ledger, event } = fixture();
    expect(advanceEventStep(world, event.id, 'PROBE', 1)).toBe(true);
    const advanced = world.narrative.events.find((entry) => entry.id === event.id);
    if (!advanced) throw new Error('Event fehlt');
    expect(resolveBeatChoices(world, ledger, advanced, template).map((choice) => choice.choiceId))
      .toEqual(['ANSWER', 'WAIT']);
  });

  it('leitet den Live-Kontext rein aus Welt und Ledger ab', () => {
    const { world, ledger, event } = fixture();
    const context = buildChoiceContext(world, ledger, event);
    expect(context.tick).toBe(world.tick);
    expect(context.houseBalance).toBe(ledger.getBalance(HAUSKONTO));
    expect(context.participants).toEqual(event.participants);
    expect(context.flags).toEqual(world.narrative.flags);
  });

  it('liefert ohne passende Template-Version keine Choices', () => {
    const { world, ledger, event } = fixture();
    expect(resolveBeatChoices(world, ledger, event, { ...template, version: 2 })).toEqual([]);
  });
});
