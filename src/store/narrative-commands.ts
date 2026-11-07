/** Store-Naht fuer Narrative: Choice ausfuehren, Szene ablehnen und Facts flushen. */
import type { Ledger } from '../core/economy/ledger';
import type { WorldState } from '../core/sim/types';
import { recordJournal } from '../core/sim/journal';
import { executeChoice } from '../core/sim/narrative/commands/execute';
import type { ChoiceExecution } from '../core/sim/narrative/commands/types';
import { isLiveEventStatus, transitionEvent } from '../core/sim/narrative/event-lifecycle';
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

/**
 * Lehnt eine lebende Szene ab. Der Lifecycle bleibt der einzige Schreibpfad:
 * `CANCELLED` ist terminal und setzt den Cooldown, damit dieselbe Geschichte
 * spaeter wiederkommen kann.
 */
export function dismissNarrativeCmd(world: WorldState, eventId: number): boolean {
  const event = world.narrative.events.find((entry) => entry.id === eventId);
  if (!event || !isLiveEventStatus(event.status)) return false;
  if (!transitionEvent(world, eventId, 'CANCELLED', world.tick, 'DISMISSED')) return false;
  recordJournal(world, {
    kind: 'GUEST',
    subject: event.eventId,
    cause: 'Spieler hat die Szene geschlossen',
    effect: 'Die Gelegenheit verfaellt, der Cooldown laeuft.',
  });
  return true;
}
