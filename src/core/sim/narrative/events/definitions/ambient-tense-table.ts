/** Feste Pool-Szene: angespannte Begegnung an einem Tisch. */
import { ENGINE_POOL_TRIGGER, type EventTemplate } from '../template-types';

export const AMBIENT_TENSE_TABLE_TEMPLATE: EventTemplate = {
  eventId: 'AMBIENT_TENSE_TABLE',
  version: 1,
  triggerId: ENGINE_POOL_TRIGGER,
  priority: 20,
  scope: 'PAIR',
  participantRoles: ['visitor', 'visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['welcome'] },
    { id: 'CHOICE_DEFUSE', kind: 'CHOICE_LABEL' },
    { id: 'CHOICE_ESCALATE', kind: 'CHOICE_LABEL' },
    { id: 'OUTCOME_DEFUSED', kind: 'OUTCOME' },
    { id: 'OUTCOME_ESCALATED', kind: 'OUTCOME' },
  ],
  choices: [
    {
      choiceId: 'DEFUSE_TABLE',
      labelSlotId: 'CHOICE_DEFUSE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: { participant: 1 },
          dimension: 'conflict',
          delta: -1,
        },
      ],
      outcomeId: 'DEFUSED',
      followUpEventId: null,
    },
    {
      choiceId: 'ESCALATE_TABLE',
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
      ],
      outcomeId: 'ESCALATED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 90,
  maxOccurrences: 0,
};
