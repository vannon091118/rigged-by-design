/** Oeffentliche Fassade fuer Event-Scheduler, Lifecycle, Schema und Narrativ-RNG. */
export type {
  EventCandidate, NarrativeCooldown, NarrativeEventInstance, NarrativeEventScope,
  NarrativeEventStatus, NarrativeRngState,
} from './event-types';
export { createNarrativeRng, narrativeIndex, nextNarrativeRandom } from './narrative-rng';
export {
  advanceEventStep, canTransitionEvent, eventOccurrenceKey, expireDueEvents,
  isLiveEventStatus, isTerminalEventStatus, transitionEvent,
} from './event-lifecycle';
export { isEventCandidate, isEventInstance, normalizeEventState } from './event-schema';
export {
  canScheduleEvent, cancelStaleEvents, chainEvent, maintainEvents, scheduleCandidates, scheduleEvent,
} from './event-scheduler';
