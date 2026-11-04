/** Stabile mechanische Definition fuer das Nachspiel eines Besuchergespraechs. */
import { FOLLOW_UP_TRIGGER, type EventTemplate } from '../template-types';

export const VISITOR_AFTERMATH_TEMPLATE: EventTemplate = {
  eventId: 'VISITOR_AFTERMATH',
  version: 1,
  triggerId: FOLLOW_UP_TRIGGER,
  priority: 30,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['aftermath'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['aftermath'] },
    { id: 'CHOICE_LISTEN', kind: 'CHOICE_LABEL', requiredContexts: ['aftermath'] },
    { id: 'OUTCOME_LISTENED', kind: 'OUTCOME', requiredContexts: ['aftermath'] },
  ],
  choices: [
    {
      choiceId: 'LISTEN_ON',
      labelSlotId: 'CHOICE_LISTEN',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: 'player',
          dimension: 'trust',
          delta: 1,
        },
      ],
      outcomeId: 'LISTENED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 20,
  maxOccurrences: 2,
};
