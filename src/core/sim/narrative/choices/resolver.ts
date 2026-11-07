/**
 * Einziger Beat-Resolver: Beat-Filter, Eligibility und Kosten in einem Schritt.
 *
 * `choicesForStep` beantwortet, welche Choice im aktuellen Beat ueberhaupt
 * sichtbar ist; `checkChoiceSelection` beantwortet, ob sie jetzt ausfuehrbar
 * ist. Beides gehoert zusammen. View und Store lesen nur noch hier, damit es
 * keine zweite Ableitung der Beat-Logik gibt.
 */
import type { Ledger } from '../../../economy/ledger';
import { HAUSKONTO } from '../../money';
import type { WorldState } from '../../types';
import type { NarrativeEventInstance } from '../event-types';
import type {
  ChoiceContext, ChoiceEvaluation, EventChoice, EventTemplate,
} from '../events/template-types';
import { checkChoiceSelection, choiceCostTotal } from './eligibility';
import { choicesForStep } from './steps';

/** Anzeigefertige Beat-Choice: Eligibility plus deklarierte Kosten. */
export interface BeatChoice extends ChoiceEvaluation {
  readonly cost: number;
}

/** Der Live-Kontext ist eine reine Ableitung aus Welt und Ledger. */
export function buildChoiceContext(
  world: WorldState,
  ledger: Ledger,
  event: NarrativeEventInstance,
): ChoiceContext {
  return {
    tick: world.tick,
    flags: world.narrative.flags,
    houseBalance: ledger.getBalance(HAUSKONTO),
    relationships: world.narrative.relationships,
    participants: event.participants,
  };
}

/**
 * Loest die Choices des aktuellen Beats auf. Die Reihenfolge stammt aus dem
 * persistierten Angebot; Choices spaeterer Beats sind unsichtbar, nicht nur
 * ausgegraut. Es gibt keinen zweiten Filter- oder Eligibility-Pfad.
 */
export function resolveBeatChoices(
  world: WorldState,
  ledger: Ledger,
  event: NarrativeEventInstance,
  template: EventTemplate,
): readonly BeatChoice[] {
  const context = buildChoiceContext(world, ledger, event);
  return choicesForStep(template, event).map((choiceId) => {
    const evaluation = checkChoiceSelection(event, template, choiceId, context);
    const choice: EventChoice | null = evaluation.choice;
    return {
      choiceId: evaluation.choiceId,
      choice,
      available: evaluation.available,
      reasons: evaluation.reasons,
      cost: choice ? choiceCostTotal(choice) : 0,
    };
  });
}
