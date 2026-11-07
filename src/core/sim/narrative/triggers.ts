/** Oeffentliche Trigger-Fassade: Context, reine Auswertung und Schema-Validierung. */
export type {
  ActorRole, ConditionResult, RelationshipDimension, TriggerCondition, TriggerContext,
  TriggerDefinition, TriggerMatch,
} from './trigger-types';
export { actorRefsOfFact, buildTriggerContext } from './trigger-context';
export { evaluateTrigger, evaluateTriggerDefinition } from './trigger-evaluate';
export { isTriggerCondition, isTriggerDefinition, normalizeTriggerDefinition } from './trigger-schema';
