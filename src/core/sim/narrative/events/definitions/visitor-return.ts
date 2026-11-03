/** Stabile mechanische Definition fuer die Rueckkehr eines Besuchers. */
import type { EventTemplate } from '../template-types';

export const VISITOR_RETURN_TEMPLATE: EventTemplate = {
  eventId: 'VISITOR_RETURN',
  version: 1,
  triggerId: 'visitor-returned',
  priority: 40,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY' },
    { id: 'CHOICE_WELCOME', kind: 'CHOICE_LABEL' },
    { id: 'CHOICE_ASK', kind: 'CHOICE_LABEL' },
    { id: 'OUTCOME_WELCOMED', kind: 'OUTCOME' },
    { id: 'OUTCOME_ASKED', kind: 'OUTCOME' },
  ],
  choices: [
    {
      choiceId: 'WELCOME_BACK',
      labelSlotId: 'CHOICE_WELCOME',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: 'player',
          dimension: 'sympathy',
          delta: 1,
        },
      ],
      outcomeId: 'WELCOMED',
      followUpEventId: null,
    },
    {
      choiceId: 'ASK_ABOUT_LAST_VISIT',
      labelSlotId: 'CHOICE_ASK',
      requirements: [
        { op: 'event-step', step: 'START' },
        { op: 'flag-at-least', flag: 'startpool', value: 1 },
      ],
      costs: [],
      effects: [{ kind: 'SET_FLAG', flag: 'asked_about_visit', delta: 1 }],
      outcomeId: 'ASKED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 20,
  maxOccurrences: 2,
};
