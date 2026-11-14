/**
 * @module world-tick — der Welt-Takt des Stores an einer Stelle
 *
 * Der Takt besitzt Intervall, Zaehler und Fehlergrenze. Ein Fehler beendet ihn
 * dauerhaft: kein zweiter Lauf auf demselben inkonsistenten Zustand, keine
 * Save- oder Journal-Buchung aus dem Fehlerpfad. Nur `reset()` (neues Spiel,
 * Import) gibt ihn wieder frei.
 */
import type { Ledger } from '../core/economy/ledger';
import type { Prng } from '../core/rng/prng';
import { TICK_MS } from '../core/sim/tick-timing';
import type { WorldState } from '../core/sim/types';
import { advanceWorld } from './narrative-clock';
import { LedgerHalt } from './ledger-halt';
import { TickScheduler } from './tick-scheduler';

export interface WorldTickOptions {
  readonly world: () => WorldState;
  readonly ledger: () => Ledger;
  readonly prng: () => Prng;
  readonly arriveStreetDoor: () => boolean;
  readonly leaveApartmentDoor: () => boolean;
  readonly leaveInteriorDoor: () => boolean;
  readonly emit: (save: boolean) => void;
  readonly hasListeners: () => boolean;
  /** Nur die Sicht neu bauen; der Store entscheidet ueber Speichern und Buchen. */
  readonly fault: (message: string) => void;
}

export class WorldTick {
  readonly #halt = new LedgerHalt();
  readonly #scheduler: TickScheduler;
  #savedTick = 0;

  constructor(private readonly options: WorldTickOptions) {
    this.#scheduler = new TickScheduler({
      tickMs: TICK_MS,
      tick: () => this.run(),
      onFault: (error) => this.#onFault(error),
    });
  }

  start(): void { this.#scheduler.start(); }
  stop(): void { this.#scheduler.stop(); }

  /** Neues Spiel oder Import: ein angehaltener Takt wird wieder freigegeben. */
  reset(): void {
    this.#halt.clear();
    this.#scheduler.reset();
    this.#savedTick = 0;
    if (this.options.hasListeners()) this.#scheduler.start();
  }

  run(): void {
    advanceWorld(this.options.world(), this.options.ledger(), this.options.prng());
    if (this.options.arriveStreetDoor()) return;
    if (this.options.leaveApartmentDoor()) return;
    if (this.options.leaveInteriorDoor()) return;
    this.#savedTick += 1;
    this.options.emit(this.#savedTick % 6 === 0);
  }

  #onFault(error: unknown): void {
    this.#halt.halt(error);
    this.options.fault(this.#halt.message ?? 'Simulation angehalten.');
  }
}
