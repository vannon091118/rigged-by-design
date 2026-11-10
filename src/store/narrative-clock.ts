/** Popup-Pause fuer Erzaehlfristen: der Welt-Tick laeuft weiter, offene Szenen verlieren keine Zeit. */
import type { Ledger } from '../core/economy/ledger';
import type { Prng } from '../core/rng/prng';
import { holdLiveDeadlines } from '../core/sim/narrative/event-lifecycle';
import { tickWorld } from '../core/sim/tick';
import { tickActionQueue } from '../core/sim/action-queue';
import type { WorldState } from '../core/sim/types';

let paused = false;

/** Ein Popup verdeckt den Floor: Szenen behalten ihre Frist, bis er sich schliesst. */
export function setNarrativePaused(value: boolean): void { paused = value; }

/** Ein Takt; die Pause schiebt die Frist vor dem Tick, damit world.tick unveraendert weiterlaeuft. */
export function advanceWorld(world: WorldState, ledger: Ledger, prng: Prng): void {
  if (paused) holdLiveDeadlines(world, 1);
  tickWorld(world, ledger, prng);
  // Die Queue laeuft nach dem Welt-Tick; sie liest und schreibt nur Weltzustand.
  tickActionQueue(world, ledger);
}
