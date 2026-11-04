/** Stabile mechanische Definition fuer eine Rivalenhandlung am Spielerhaus. */
import type { EventTemplate } from '../template-types';

export const RIVAL_MOVE_TEMPLATE: EventTemplate = {
  eventId: 'RIVAL_MOVE',
  version: 1,
  triggerId: 'rival-action',
  priority: 45,
  scope: 'RIVAL',
  participantRoles: ['rival'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['rival'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['rival'] },
    { id: 'CHOICE_CONFRONT', kind: 'CHOICE_LABEL', requiredContexts: ['rival', 'confront'] },
    { id: 'CHOICE_WATCH', kind: 'CHOICE_LABEL', requiredContexts: ['rival', 'watch'] },
    { id: 'OUTCOME_CONFRONTED', kind: 'OUTCOME', requiredContexts: ['rival', 'aftermath'] },
    { id: 'OUTCOME_WATCHED', kind: 'OUTCOME', requiredContexts: ['rival', 'aftermath'] },
  ],
  choices: [
    {
      choiceId: 'CONFRONT_RIVAL',
      labelSlotId: 'CHOICE_CONFRONT',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        {
          kind: 'ADJUST_RELATIONSHIP',
          from: { participant: 0 },
          to: 'player',
          dimension: 'conflict',
          delta: 2,
        },
        { kind: 'SET_FLAG', flag: 'rival_confrontations', delta: 1 },
      ],
      outcomeId: 'CONFRONTED',
      followUpEventId: null,
    },
    {
      choiceId: 'WATCH_THE_MOVE',
      labelSlotId: 'CHOICE_WATCH',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [{ kind: 'SET_FLAG', flag: 'rival_watched', delta: 1 }],
      outcomeId: 'WATCHED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 25,
  cooldownTicks: 60,
  maxOccurrences: 2,
};
