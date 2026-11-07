/** Choice-Vertrag: stabile IDs bleiben an Template-ID und Version gebunden. */
import type { NarrativeEventInstance } from '../event-types';
import type { EventChoice, EventTemplate } from '../events/template-types';
import { EVENT_TEMPLATE_LIMITS } from '../events/template-types';

/** Der angebotene Satz ist eine stabile, begrenzte ID-Liste aus dem Template. */
export function offerChoiceIds(template: EventTemplate): readonly string[] {
  return template.choices.slice(0, EVENT_TEMPLATE_LIMITS.offeredChoices).map((choice) => choice.choiceId);
}

/** Unbekannte, nicht angebotene oder versionsfremde Choices liefern null. */
export function resolveOfferedChoice(
  template: EventTemplate,
  event: NarrativeEventInstance,
  choiceId: string,
): EventChoice | null {
  if (template.eventId !== event.eventId || template.eventId !== event.templateId
    || template.version !== event.templateVersion) return null;
  if (!event.offeredChoiceIds.includes(choiceId)) return null;
  return template.choices.find((choice) => choice.choiceId === choiceId) ?? null;
}
