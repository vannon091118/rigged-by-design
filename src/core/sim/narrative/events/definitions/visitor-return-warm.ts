/** Zweite Stufe der Rueckkehr: Wer Gutes mitbringt, bekommt zusaetzlich eine warme Szene. */
import type { EventTemplate } from '../template-types';

export const VISITOR_RETURN_WARM_TEMPLATE: EventTemplate = {
  eventId: 'VISITOR_RETURN_WARM',
  version: 1,
  triggerId: 'visitor-returned-warm',
  priority: 50,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['return'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['return'] },
    { id: 'CHOICE_WARM', kind: 'CHOICE_LABEL', requiredContexts: ['return', 'welcome'] },
    { id: 'OUTCOME_WARMED', kind: 'OUTCOME', requiredContexts: ['return', 'aftermath'] },
  ],
  choices: [
    {
      choiceId: 'WARM_WELCOME',
      labelSlotId: 'CHOICE_WARM',
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
      outcomeId: 'WARMED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 20,
  maxOccurrences: 2,
};
