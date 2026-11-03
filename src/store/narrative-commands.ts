/** Store-Naht fuer Narrative: Choice ausfuehren und Facts an der Mutationsgrenze flushen. */
import type { Ledger } from '../core/economy/ledger';
import type { WorldState } from '../core/sim/types';
import { executeChoice } from '../core/sim/narrative/commands/execute';
import type { ChoiceExecution } from '../core/sim/narrative/commands/types';
import { processNarrativeRuntime, type NarrativeRuntimeResult } from '../core/sim/narrative/runtime';

/** Verarbeitet alle seit der letzten Grenze entstandenen Facts genau einmal. */
export function flushNarrativeCmd(world: WorldState, ledger: Ledger): NarrativeRuntimeResult {
  return processNarrativeRuntime(world, ledger);
}

/** Fuehrt eine Choice aus; der Aufrufer flusht danach die entstandenen Facts. */
export function chooseNarrativeCmd(
  world: WorldState,
  ledger: Ledger,
  eventId: number,
  choiceId: string,
): ChoiceExecution {
  return executeChoice(world, ledger, eventId, choiceId);
}
