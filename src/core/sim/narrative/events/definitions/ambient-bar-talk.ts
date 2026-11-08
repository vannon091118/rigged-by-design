/** Feste Pool-Szene: zwei Gaeste kommen an der Bar ins Gespraech. */
import { ENGINE_POOL_TRIGGER, type EventTemplate } from '../template-types';

export const AMBIENT_BAR_TALK_TEMPLATE: EventTemplate = {
  eventId: 'AMBIENT_BAR_TALK',
  version: 1,
  triggerId: ENGINE_POOL_TRIGGER,
  priority: 20,
  scope: 'PAIR',
  participantRoles: ['visitor', 'visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['welcome'] },
    { id: 'CHOICE_JOIN', kind: 'CHOICE_LABEL' },
    { id: 'OUTCOME_JOINED', kind: 'OUTCOME' },
  ],
  choices: [
    {
      choiceId: 'JOIN_TALK',
      labelSlotId: 'CHOICE_JOIN',
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
      ],
      outcomeId: 'JOINED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 40,
  cooldownTicks: 90,
  maxOccurrences: 0,
};
