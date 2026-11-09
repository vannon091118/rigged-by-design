/**
 * Verzoegerte Folge der Begegnung. Es gibt zwei mechanisch getrennte Pfade:
 * Wer gegeben oder geholfen hat, bekommt eine Einladung; wer abgelehnt hat,
 * bekommt einen Konflikt. Beide Knoten werden ausschliesslich von der Kette
 * geplant, nie von einem eigenen Trigger.
 */
import { FOLLOW_UP_TRIGGER, type EventTemplate } from '../template-types';

export const CITY_ENCOUNTER_ECHO_WARM_TEMPLATE: EventTemplate = {
  eventId: 'CITY_ENCOUNTER_ECHO_WARM',
  version: 1,
  triggerId: FOLLOW_UP_TRIGGER,
  priority: 25,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['encounter', 'echo', 'warm'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['encounter', 'echo', 'warm'] },
    { id: 'CHOICE_ECHO', kind: 'CHOICE_LABEL', requiredContexts: ['encounter', 'echo'] },
  ],
  choices: [
    {
      choiceId: 'THANK_ECHO',
      labelSlotId: 'CHOICE_ECHO',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'trust', delta: 1 },
        { kind: 'SET_FLAG', flag: 'encounter_echo_seen', delta: 1 },
      ],
      outcomeId: 'ECHO_ACCEPTED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 60,
  cooldownTicks: 0,
  maxOccurrences: 99,
};

export const CITY_ENCOUNTER_ECHO_COLD_TEMPLATE: EventTemplate = {
  eventId: 'CITY_ENCOUNTER_ECHO_COLD',
  version: 1,
  triggerId: FOLLOW_UP_TRIGGER,
  priority: 25,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['encounter', 'echo', 'cold'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['encounter', 'echo', 'cold'] },
    { id: 'CHOICE_ECHO', kind: 'CHOICE_LABEL', requiredContexts: ['encounter', 'echo'] },
  ],
  choices: [
    {
      choiceId: 'CLEAR_THE_AIR',
      labelSlotId: 'CHOICE_ECHO',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'conflict', delta: -1 },
        { kind: 'SET_FLAG', flag: 'encounter_echo_seen', delta: 1 },
      ],
      outcomeId: 'ECHO_CLEARED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 60,
  cooldownTicks: 0,
  maxOccurrences: 99,
};
