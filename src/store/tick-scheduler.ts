/**
 * @module tick-scheduler — der eine Takt des Welt-Stores
 *
 * Der Scheduler besitzt das Intervall und die Fehlergrenze: Ein Fehler im Tick
 * haelt den Takt dauerhaft an, statt im naechsten Intervall auf demselben
 * inkonsistenten Zustand weiterzulaufen. Nur ein ausdrueckliches `reset()`
 * (neues Spiel, Import) gibt den Takt wieder frei.
 */

export interface TickSchedulerOptions {
  readonly tickMs: number;
  readonly tick: () => void;
  /** Wird genau einmal aufgerufen; danach laeuft kein Tick mehr. */
  readonly onFault: (error: unknown) => void;
}

export class TickScheduler {
  #timer: ReturnType<typeof setInterval> | null = null;
  #halted = false;

  constructor(private readonly options: TickSchedulerOptions) {}

  get halted(): boolean { return this.#halted; }

  /** Startet nur, solange der Takt nicht angehalten ist und kein Timer laeuft. */
  start(): void {
    if (this.#halted || this.#timer !== null) return;
    this.#timer = setInterval(this.#run, this.options.tickMs);
  }

  stop(): void {
    if (this.#timer === null) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  /** Gibt einen angehaltenen Takt wieder frei; der Timer startet erst mit `start()`. */
  reset(): void { this.#halted = false; }

  #run = (): void => {
    if (this.#halted) return;
    try {
      this.options.tick();
    } catch (error) {
      // Fail-closed: erst anhalten, dann melden. Kein zweiter Lauf auf demselben Zustand.
      this.#halted = true;
      this.stop();
      this.options.onFault(error);
    }
  };
}
