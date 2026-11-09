/** Feste Pool-Szene: eine gemeinsame Runde zwischen zwei Gaesten. */
import { ENGINE_POOL_TRIGGER, type EventTemplate } from '../template-types';

export const AMBIENT_SHARED_ROUND_TEMPLATE: EventTemplate = {
  eventId: 'AMBIENT_SHARED_ROUND',
  version: 1,
  triggerId: ENGINE_POOL_TRIGGER,
  priority: 15,
  scope: 'PAIR',
  participantRoles: ['visitor', 'visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['ambient-round'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['ambient-round'] },
    { id: 'CHOICE_SHARE', kind: 'CHOICE_LABEL', requiredContexts: ['give'] },
    { id: 'OUTCOME_SHARED', kind: 'OUTCOME', requiredContexts: ['give'] },
  ],
  choices: [
    {
      choiceId: 'SHARE_ROUND',
      labelSlotId: 'CHOICE_SHARE',
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
      outcomeId: 'SHARED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 40,
  cooldownTicks: 90,
  maxOccurrences: 0,
};
