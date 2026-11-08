/** Fail-closed Validierung fuer Event-Templates, Choices und ihre statischen Teile. */
import { isActorRef } from '../relationships';
import { NARRATIVE_EVENT_SCOPES, type NarrativeEventScope } from '../event-types';
import type { ActorRole, RelationshipDimension } from '../trigger-types';
import {
  ENGINE_DEMAND_TRIGGER, ENGINE_POOL_TRIGGER, EVENT_TEMPLATE_LIMITS, type ChoiceActor, type ChoiceEffect,
  type ChoiceRequirement, type ContentSlot, type ContentSlotKind, type EventChoice, type EventTemplate,
} from './template-types';

const ACTOR_ROLES: readonly ActorRole[] = ['visitor', 'staff', 'rival', 'player'];
const SLOT_KINDS: readonly ContentSlotKind[] = ['TITLE', 'BODY', 'CHOICE_LABEL', 'OUTCOME'];
const DIMENSIONS: readonly RelationshipDimension[] = ['trust', 'sympathy', 'conflict', 'influence'];
const ID = /^[A-Z][A-Z0-9_]{0,63}$/;
const STEP = /^[A-Z][A-Z0-9_]{0,31}$/;
const FLAG = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const CONTEXT = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SLOT_CONTEXTS = 4;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isSafeInt = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isScope = (value: unknown): value is NarrativeEventScope =>
  typeof value === 'string' && (NARRATIVE_EVENT_SCOPES as readonly string[]).includes(value);
const isRole = (value: unknown): value is ActorRole =>
  typeof value === 'string' && (ACTOR_ROLES as readonly string[]).includes(value);
const isDimension = (value: unknown): value is RelationshipDimension =>
  typeof value === 'string' && (DIMENSIONS as readonly string[]).includes(value);
const isSlotKind = (value: unknown): value is ContentSlotKind =>
  typeof value === 'string' && (SLOT_KINDS as readonly string[]).includes(value);

export const isChoiceId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const isStep = (value: unknown): value is string => typeof value === 'string' && STEP.test(value);
const isFlag = (value: unknown): value is string => typeof value === 'string' && FLAG.test(value);

/** Sammelt die Schritte, an denen eine Choice per `event-step` haengt. */
export function stepRequirements(requirements: readonly ChoiceRequirement[]): string[] {
  const steps: string[] = [];
  for (const requirement of requirements) {
    if (requirement.op === 'event-step') steps.push(requirement.step);
    else if (requirement.op === 'all') steps.push(...stepRequirements(requirement.requirements));
  }
  return steps;
}

function isContentSlot(raw: unknown): raw is ContentSlot {
  if (!isRecord(raw) || !isChoiceId(raw.id) || !isSlotKind(raw.kind)) return false;
  if (raw.requiredContexts === undefined) return true;
  return Array.isArray(raw.requiredContexts)
    && raw.requiredContexts.length > 0 && raw.requiredContexts.length <= SLOT_CONTEXTS
    && raw.requiredContexts.every((entry) => typeof entry === 'string' && CONTEXT.test(entry))
    && new Set(raw.requiredContexts).size === raw.requiredContexts.length;
}

function isChoiceActor(raw: unknown, participantCount: number): raw is ChoiceActor {
  if (typeof raw === 'string') return isActorRef(raw);
  return participantCount > 0 && isRecord(raw) && isSafeInt(raw.participant, 0, participantCount - 1);
}

function sameActor(left: ChoiceActor, right: ChoiceActor): boolean {
  if (typeof left === 'string' || typeof right === 'string') return left === right;
  return left.participant === right.participant;
}

function isRequirement(raw: unknown, participantCount: number, depth = 0): raw is ChoiceRequirement {
  if (!isRecord(raw) || depth > EVENT_TEMPLATE_LIMITS.requirementDepth) return false;
  switch (raw.op) {
    case 'all':
      return Array.isArray(raw.requirements) && raw.requirements.length > 0
        && raw.requirements.length <= EVENT_TEMPLATE_LIMITS.requirements
        && raw.requirements.every((child) => isRequirement(child, participantCount, depth + 1));
    case 'event-step':
      return isStep(raw.step);
    case 'flag-at-least':
      return isFlag(raw.flag) && isSafeInt(raw.value, -1_000_000, 1_000_000);
    case 'flag-present':
      return isFlag(raw.flag);
    case 'house-at-least':
      return isSafeInt(raw.amount, 0);
    case 'relationship-at-least':
      return isChoiceActor(raw.from, participantCount) && isChoiceActor(raw.to, participantCount)
        && !sameActor(raw.from, raw.to) && isDimension(raw.dimension) && isSafeInt(raw.value, -10, 10);
    default:
      return false;
  }
}

function isCost(raw: unknown): boolean {
  return isRecord(raw) && raw.kind === 'VACOIN' && isSafeInt(raw.amount, 1);
}

function isEffect(raw: unknown, participantCount: number): raw is ChoiceEffect {
  if (!isRecord(raw)) return false;
  if (raw.kind === 'SET_FLAG') return isFlag(raw.flag) && isSafeInt(raw.delta, -1000, 1000) && raw.delta !== 0;
  if (raw.kind === 'FREEZE_TICK') return isSafeInt(raw.ticks, 1, 200);
  if (raw.kind === 'TRIGGER_DIALOG') return isText(raw.dialogId, 64) && /^[A-Z][A-Z0-9_]{0,63}$/.test(raw.dialogId);
  if (raw.kind === 'COUNTER_RIVAL') return isChoiceActor(raw.rival, participantCount);
  if (raw.kind !== 'ADJUST_RELATIONSHIP') return false;
  return isChoiceActor(raw.from, participantCount) && isChoiceActor(raw.to, participantCount)
    && !sameActor(raw.from, raw.to) && isDimension(raw.dimension)
    && isSafeInt(raw.delta, -10, 10) && raw.delta !== 0;
}

export function isEventChoice(raw: unknown, participantCount: number, labelSlotIds: ReadonlySet<string>): raw is EventChoice {
  if (!isRecord(raw) || !isChoiceId(raw.choiceId) || !isChoiceId(raw.labelSlotId)
    || !labelSlotIds.has(raw.labelSlotId) || !isChoiceId(raw.outcomeId)) return false;
  if (!Array.isArray(raw.requirements) || raw.requirements.length > EVENT_TEMPLATE_LIMITS.requirements
    || !raw.requirements.every((entry) => isRequirement(entry, participantCount))) return false;
  if (!Array.isArray(raw.costs) || raw.costs.length > EVENT_TEMPLATE_LIMITS.costs
    || !raw.costs.every(isCost)) return false;
  if (!Array.isArray(raw.effects) || raw.effects.length > EVENT_TEMPLATE_LIMITS.effects
    || !raw.effects.every((entry) => isEffect(entry, participantCount))) return false;
  return (raw.followUpEventId === null || isChoiceId(raw.followUpEventId))
    && (raw.nextStep === undefined || raw.nextStep === null || isStep(raw.nextStep));
}

function validRoles(scope: NarrativeEventScope, raw: unknown): raw is readonly ActorRole[] {
  if (!Array.isArray(raw) || !raw.every(isRole)) return false;
  if (scope === 'GLOBAL') return raw.length === 0;
  if (scope === 'VISITOR') return raw.length === 1 && raw[0] === 'visitor';
  if (scope === 'RIVAL') return raw.length === 1 && raw[0] === 'rival';
  return raw.length === 2;
}

export function isEventTemplate(raw: unknown): raw is EventTemplate {
  if (!isRecord(raw) || !isChoiceId(raw.eventId) || !isText(raw.triggerId, 64)
    || !isSafeInt(raw.version, 1, 1000) || !isSafeInt(raw.priority, 0, 1000)
    || !isScope(raw.scope) || !validRoles(raw.scope, raw.participantRoles)) return false;
  if (!Array.isArray(raw.contentSlots) || raw.contentSlots.length === 0
    || raw.contentSlots.length > EVENT_TEMPLATE_LIMITS.contentSlots
    || !raw.contentSlots.every(isContentSlot)) return false;
  const slotIds = raw.contentSlots.map((slot) => slot.id);
  if (new Set(slotIds).size !== slotIds.length) return false;
  const engineDemand = raw.triggerId === ENGINE_DEMAND_TRIGGER;
  const engineManaged = engineDemand || raw.triggerId === ENGINE_POOL_TRIGGER;
  const labelIds = new Set(raw.contentSlots.filter((slot) => slot.kind === 'CHOICE_LABEL').map((slot) => slot.id));
  const roleCount = Array.isArray(raw.participantRoles) ? raw.participantRoles.length : 0;
  if (!Array.isArray(raw.choices) || raw.choices.length > EVENT_TEMPLATE_LIMITS.choices
    || (!engineDemand && raw.choices.length === 0)
    || !raw.choices.every((choice) => isEventChoice(choice, roleCount, labelIds))) return false;
  const choiceIds = raw.choices.map((choice) => choice.choiceId);
  if (new Set(choiceIds).size !== choiceIds.length) return false;
  // Ein Schrittwechsel braucht einen Anschluss: entweder bietet eine step-freie
  // Choice ihn ueberall an, oder mindestens eine Choice haengt an genau diesem Schritt.
  const stepFree = raw.choices.some((choice) => stepRequirements(choice.requirements).length === 0);
  if (!stepFree) {
    const reachable = new Set<string>(
      raw.choices.flatMap((choice) => stepRequirements(choice.requirements)),
    );
    if (raw.choices.some((choice) => typeof choice.nextStep === 'string' && !reachable.has(choice.nextStep))) return false;
  }
  return isStep(raw.initialStep) && isSafeInt(raw.expiresInTicks, 0, 100_000)
    && isSafeInt(raw.cooldownTicks, 0, 1_000_000)
    && isSafeInt(raw.maxOccurrences, engineManaged ? 0 : 1, 100);
}

export function isOfferedChoiceIds(raw: unknown): raw is readonly string[] {
  if (!Array.isArray(raw) || raw.length > EVENT_TEMPLATE_LIMITS.offeredChoices) return false;
  if (!raw.every(isChoiceId)) return false;
  return new Set(raw).size === raw.length;
}

/** Entfernt ungueltige/doppelte IDs und begrenzt den persistierten Satz. */
export function normalizeOfferedChoiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isChoiceId))].slice(0, EVENT_TEMPLATE_LIMITS.offeredChoices);
}
