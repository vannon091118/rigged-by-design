/**
 * Die Begegnung im Ort: eine echte Szene mit benanntem Gegenueber, nicht ein
 * Fortschrittspunkt. Die drei Choices sind die sozialen Handlungen; Geld bucht
 * die Stadt selbst aus dem Portemonnaie, Beziehung und Flag schreibt der
 * regulaere Command-Pfad.
 */
import type { EventTemplate } from '../template-types';

export const CITY_ENCOUNTER_EVENT_ID = 'CITY_ENCOUNTER';

export const CITY_ENCOUNTER_TEMPLATE: EventTemplate = {
  eventId: CITY_ENCOUNTER_EVENT_ID,
  version: 1,
  triggerId: 'city-encounter',
  priority: 55,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE', requiredContexts: ['encounter'] },
    { id: 'BODY', kind: 'BODY', requiredContexts: ['encounter'] },
    { id: 'CHOICE_GIVE', kind: 'CHOICE_LABEL', requiredContexts: ['encounter', 'give'] },
    { id: 'CHOICE_HELP', kind: 'CHOICE_LABEL', requiredContexts: ['encounter', 'help'] },
    { id: 'CHOICE_DECLINE', kind: 'CHOICE_LABEL', requiredContexts: ['encounter', 'decline'] },
  ],
  choices: [
    {
      choiceId: 'GIVE_ROUND',
      labelSlotId: 'CHOICE_GIVE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'trust', delta: 2 },
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'sympathy', delta: 1 },
        { kind: 'SET_FLAG', flag: 'encounter_gift', delta: 1 },
      ],
      outcomeId: 'GAVE_ROUND',
      followUpEventId: null,
    },
    {
      choiceId: 'HELP_CRATE',
      labelSlotId: 'CHOICE_HELP',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'trust', delta: 1 },
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'sympathy', delta: 2 },
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'conflict', delta: -1 },
        { kind: 'SET_FLAG', flag: 'encounter_help', delta: 1 },
      ],
      outcomeId: 'HELPED_OUT',
      followUpEventId: null,
    },
    {
      choiceId: 'DECLINE_ASK',
      labelSlotId: 'CHOICE_DECLINE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [],
      effects: [
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'trust', delta: -1 },
        { kind: 'ADJUST_RELATIONSHIP', from: { participant: 0 }, to: 'player', dimension: 'conflict', delta: 1 },
        { kind: 'SET_FLAG', flag: 'encounter_decline', delta: 1 },
      ],
      outcomeId: 'DECLINED',
      followUpEventId: null,
    },
  ],
  initialStep: 'START',
  expiresInTicks: 40,
  cooldownTicks: 0,
  maxOccurrences: 99,
};
