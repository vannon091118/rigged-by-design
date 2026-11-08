/**
 * Spaetere Wiederbegegnung nach einer aufgeloesten Kette. Der Knoten hat keinen
 * eigenen Trigger: er wird ausschliesslich von der Kettenlaufzeit geplant.
 */
import { FOLLOW_UP_TRIGGER, type EventTemplate } from '../template-types';

export const CHAIN_VISITOR_ECHO_TEMPLATE: EventTemplate = {
  eventId: 'CHAIN_VISITOR_ECHO',
  version: 1,
  triggerId: FOLLOW_UP_TRIGGER,
  priority: 20,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['aftermath', 'echo'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['aftermath', 'echo'] },
    { id: 'CHOICE_ACK', kind: 'CHOICE_LABEL', requiredContexts: ['aftermath', 'echo'] },
    { id: 'OUTCOME_ACK', kind: 'OUTCOME', requiredContexts: ['aftermath', 'echo'] },
  ],
  choices: [
    {
      choiceId: 'ACKNOWLEDGE_ECHO',
      labelSlotId: 'CHOICE_ACK',
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
        { kind: 'SET_FLAG', flag: 'echo_seen', delta: 1 },
      ],
      outcomeId: 'ECHOED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 0,
  maxOccurrences: 2,
};
