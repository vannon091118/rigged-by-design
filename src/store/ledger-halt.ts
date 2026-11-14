/**
 * @module ledger-halt — sichtbarer Fehlerzustand nach einem Tick-Abbruch
 *
 * Der erste Fehler gewinnt: Spaetere Laeufe duerfen die Diagnose des echten
 * Bruchs nicht mit Folgefehlern ueberschreiben. Die Meldung traegt die
 * Ledger-Diagnose (Tick, Sequenz, letzte Buchung, Konten) in den Snapshot und
 * ist damit ohne eigenen UI-Zustand sichtbar.
 */
import { LedgerBalanceError } from '../core/economy/ledger-tick-guard';

export class LedgerHalt {
  #message: string | null = null;

  get active(): boolean { return this.#message !== null; }
  get message(): string | null { return this.#message; }

  /** true nur beim ersten Fehler; die Diagnose bleibt danach unveraendert. */
  halt(error: unknown): boolean {
    if (this.#message !== null) return false;
    const detail = error instanceof LedgerBalanceError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Welt-Tick fehlgeschlagen.';
    this.#message = `Simulation angehalten: ${detail}`;
    return true;
  }

  clear(): void { this.#message = null; }
}
