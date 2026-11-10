/** Narrative Store-Aktionen: Ausfuehrung und Meldung getrennt von der Facade. */
import type { Ledger } from '../core/economy/ledger';
import type { ChoiceExecution } from '../core/sim/narrative/commands/types';
import type { WorldState } from '../core/sim/types';
import { chooseNarrativeCmd, dismissNarrativeCmd } from './narrative-commands';

export function chooseNarrativeAction(world: WorldState, ledger: Ledger, eventId: number, choiceId: string): { readonly result: ChoiceExecution | null; readonly notice: string } {
  const result = chooseNarrativeCmd(world, ledger, eventId, choiceId);
  return {
    result,
    notice: result.ok
      ? `Narrative Entscheidung: ${result.event?.resolution ?? 'aufgeloest'}.`
      : result.rejections[0]?.detail ?? 'Narrative Entscheidung abgewiesen.',
  };
}

export function dismissNarrativeAction(world: WorldState, eventId: number): string {
  return dismissNarrativeCmd(world, eventId)
    ? 'Szene geschlossen. Die Geschichte kann nach ihrem Cooldown wiederkommen.'
    : 'Diese Szene ist nicht mehr offen.';
}
