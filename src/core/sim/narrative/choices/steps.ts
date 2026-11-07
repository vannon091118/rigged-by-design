/** Schritt-Auswahl: welche angebotenen Choices gelten im aktuellen Beat? */
import type { NarrativeEventInstance } from '../event-types';
import { stepRequirements } from '../events/template-schema';
import type { EventChoice, EventTemplate } from '../events/template-types';
import { resolveOfferedChoice } from './contract';

/** Ohne `event-step` gilt eine Choice in jedem Schritt. */
function choiceOfferedAtStep(choice: EventChoice, step: string): boolean {
  const steps = stepRequirements(choice.requirements);
  return steps.length === 0 || steps.includes(step);
}

/**
 * Der persistierte Satz, gefiltert auf den aktuellen Schritt. Die Reihenfolge
 * bleibt die des Angebots; eine Choice eines spaeteren Beats ist unsichtbar,
 * nicht nur ausgegraut, und bleibt bis dahin auch nicht ausfuehrbar.
 */
export function choicesForStep(
  template: EventTemplate,
  event: NarrativeEventInstance,
): readonly string[] {
  return event.offeredChoiceIds.filter((choiceId) => {
    const choice = resolveOfferedChoice(template, event, choiceId);
    return choice !== null && choiceOfferedAtStep(choice, event.step);
  });
}
