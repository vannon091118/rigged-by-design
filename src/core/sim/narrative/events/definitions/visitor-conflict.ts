/** Stabile mechanische Definition fuer einen Streit zwischen zwei Besuchern. */
import type { EventTemplate } from '../template-types';

export const VISITOR_CONFLICT_TEMPLATE: EventTemplate = {
  eventId: 'VISITOR_CONFLICT',
  version: 1,
  triggerId: 'visitor-conflict',
  priority: 80,
  scope: 'PAIR',
  participantRoles: ['visitor', 'visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY' },
    { id: 'CHOICE_DEFUSE', kind: 'CHOICE_LABEL' },
    { id: 'CHOICE_ESCALATE', kind: 'CHOICE_LABEL' },
    { id: 'OUTCOME_DEFUSED', kind: 'OUTCOME' },
    { id: 'OUTCOME_ESCALATED', kind: 'OUTCOME' },
  ],
  choices: [
    {
      choiceId: 'DEFUSE',
      labelSlotId: 'CHOICE_DEFUSE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: { participant: 1 },
          dimension: 'sympathy',
          delta: 1,
        },
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 1 },
          to: { participant: 0 },
          dimension: 'sympathy',
          delta: 1,
        },
      ],
      outcomeId: 'DEFUSED',
      followUpEventId: null,
    },
    {
      choiceId: 'ESCALATE',
      labelSlotId: 'CHOICE_ESCALATE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: { participant: 1 },
          dimension: 'conflict',
          delta: 1,
        },
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 1 },
          to: { participant: 0 },
          dimension: 'conflict',
          delta: 1,
        },
      ],
      outcomeId: 'ESCALATED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 15,
  cooldownTicks: 60,
  maxOccurrences: 1,
};
