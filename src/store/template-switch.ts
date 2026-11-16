/** Vorlagenwechsel als eigener Vorgang: Umbau, Fehlermeldung und kein halber Zustand. */
import type { Ledger } from '../core/economy/ledger';
import { remodel } from '../core/sim/remodel';
import type { TemplateId, WorldState } from '../core/sim/types';

interface TemplateSwitch {
  readonly world: WorldState;
  readonly notice: string;
}

/** Ein Fehlschlag laesst die Welt unveraendert und liefert nur den Grund. */
export function switchTemplate(
  world: WorldState, ledger: Ledger, template: TemplateId, tick: number,
): TemplateSwitch {
  try {
    const next = remodel(world, ledger, template, tick);
    return { world: next, notice: next.lastEvent };
  } catch (error) {
    return { world, notice: error instanceof Error ? error.message : 'Umbau fehlgeschlagen.' };
  }
}
