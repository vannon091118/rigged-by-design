/** Reine Choice-Eligibility: Lifecycle, Requirements und Kosten ohne Seiteneffekte. */
import type { NarrativeEventInstance } from '../event-types';
import { isLiveEventStatus } from '../event-lifecycle';
import type { ActorRef } from '../types';
import {
  type ChoiceActor, type ChoiceBlockReason, type ChoiceContext, type ChoiceEvaluation,
  type ChoiceRequirement, type EventChoice, type EventTemplate,
} from '../events/template-types';
import { resolveOfferedChoice } from './contract';

const safeTick = (tick: number): number => (Number.isSafeInteger(tick) && tick >= 0 ? tick : 0);
const safeBalance = (balance: number): number => (Number.isFinite(balance) ? balance : 0);

function actorAt(actor: ChoiceActor, participants: readonly ActorRef[]): ActorRef | null {
  if (typeof actor === 'string') return actor;
  return participants[actor.participant] ?? null;
}

function requirementHolds(requirement: ChoiceRequirement, step: string, context: ChoiceContext): boolean {
  switch (requirement.op) {
    case 'all':
      return requirement.requirements.every((child) => requirementHolds(child, step, context));
    case 'event-step':
      return step === requirement.step;
    case 'flag-at-least':
      return (context.flags[requirement.flag] ?? 0) >= requirement.value;
    case 'flag-present':
      return context.flags[requirement.flag] !== undefined;
    case 'house-at-least':
      return safeBalance(context.houseBalance) >= requirement.amount;
    case 'relationship-at-least': {
      const from = actorAt(requirement.from, context.participants);
      const to = actorAt(requirement.to, context.participants);
      if (!from || !to || from === to) return false;
      return context.relationships.some((edge) => edge.from === from && edge.to === to
        && edge[requirement.dimension] >= requirement.value);
    }
    default:
      return false;
  }
}

/** Summe aller deklarierten Kosten; Ueberlauf wird als unbezahlbar behandelt. */
export function choiceCostTotal(choice: EventChoice): number {
  let total = 0;
  for (const cost of choice.costs) {
    if (total > Number.MAX_SAFE_INTEGER - cost.amount) return Number.MAX_SAFE_INTEGER;
    total += cost.amount;
  }
  return total;
}

/** Ein Klick wird gegen den persistierten Satz, den Lifecycle und den Live-Kontext geprueft. */
export function checkChoiceSelection(
  event: NarrativeEventInstance,
  template: EventTemplate,
  choiceId: string,
  context: ChoiceContext,
): ChoiceEvaluation {
  const reasons: ChoiceBlockReason[] = [];
  const choice = resolveOfferedChoice(template, event, choiceId);
  const tick = safeTick(context.tick);
  if (!isLiveEventStatus(event.status)) reasons.push('EVENT_NOT_LIVE');
  if (event.expiresTick <= tick) reasons.push('EVENT_EXPIRED');
  if (event.eventId !== template.eventId || event.templateId !== template.eventId
    || event.templateVersion !== template.version) reasons.push('TEMPLATE_MISMATCH');
  if (!choice) reasons.push('CHOICE_NOT_OFFERED');
  if (choice && !choice.requirements.every((requirement) => requirementHolds(requirement, event.step, context))) {
    reasons.push('REQUIREMENT_NOT_MET');
  }
  if (choice && choiceCostTotal(choice) > safeBalance(context.houseBalance)) reasons.push('INSUFFICIENT_FUNDS');
  const unique = [...new Set(reasons)];
  return { choiceId, choice, available: unique.length === 0, reasons: unique };
}

/** Anzeigefertige Choices; die Reihenfolge stammt aus dem persistierten Satz. */
export function availableChoices(
  event: NarrativeEventInstance,
  template: EventTemplate,
  context: ChoiceContext,
): EventChoice[] {
  return event.offeredChoiceIds
    .map((choiceId) => checkChoiceSelection(event, template, choiceId, context))
    .filter((evaluation): evaluation is ChoiceEvaluation & { readonly choice: EventChoice } => evaluation.available && evaluation.choice !== null)
    .map((evaluation) => evaluation.choice);
}
