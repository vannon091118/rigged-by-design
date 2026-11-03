/** Oeffentliche Fassade fuer Event-Scheduler, Templates, Choices und Narrativ-RNG. */
export type {
  EventCandidate, NarrativeCooldown, NarrativeEventInstance, NarrativeEventScope,
  NarrativeEventStatus, NarrativeRngState,
} from './event-types';
export type {
  ChoiceActor, ChoiceBlockReason, ChoiceContext, ChoiceCost, ChoiceEffect, ChoiceEvaluation,
  ChoiceRequirement, ContentSlot, ContentSlotKind, EventChoice, EventTemplate,
} from './events/template-types';
export { createNarrativeRng, narrativeIndex, nextNarrativeRandom } from './narrative-rng';
export {
  advanceEventStep, canTransitionEvent, eventOccurrenceKey, expireDueEvents,
  isLiveEventStatus, isTerminalEventStatus, transitionEvent,
} from './event-lifecycle';
export { isEventCandidate, isEventInstance, normalizeEventState } from './event-schema';
export {
  canScheduleEvent, cancelStaleEvents, chainEvent, maintainEvents, scheduleCandidates, scheduleEvent,
} from './event-scheduler';
export { EVENT_TEMPLATES, templateFor } from './events/definitions';
export {
  isChoiceId, isEventChoice, isEventTemplate, isOfferedChoiceIds, normalizeOfferedChoiceIds,
} from './events/template-schema';
export { createEventCandidate, resolveParticipants } from './events/template-candidate';
export { offerChoiceIds, resolveOfferedChoice } from './choices/contract';
export { availableChoices, checkChoiceSelection, choiceCostTotal } from './choices/eligibility';
