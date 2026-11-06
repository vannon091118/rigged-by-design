/**
 * Endlicher Undo/Redo-Verlauf fuer Layout-Commands. Haelt fertige Layouts,
 * keine Commands: ein Pinselstrich ist eine Gruppe und ein Schritt, egal wie
 * viele Tiles er beruehrt hat. Kein Spielzustand, keine Persistenz.
 */
import type { LayoutState } from './layout-types';

interface LayoutHistoryEntry {
  readonly label: string;
  readonly before: LayoutState;
  readonly after: LayoutState;
}

export class LayoutHistory {
  readonly #limit: number;
  #past: LayoutHistoryEntry[] = [];
  #future: LayoutHistoryEntry[] = [];

  constructor(limit = 30) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Layout-Verlauf braucht ein positives Limit.');
    this.#limit = limit;
  }

  /** Ein Schritt ohne Layoutaenderung ist kein Schritt in der Historie. */
  push(entry: LayoutHistoryEntry): void {
    if (entry.before === entry.after) return;
    this.#past.push(entry);
    if (this.#past.length > this.#limit) {
      // Ringverhalten: der aelteste Schritt faellt heraus, der Rest bleibt stabil.
      this.#past.splice(0, this.#past.length - this.#limit);
    }
    this.#future = [];
  }

  undo(): LayoutHistoryEntry | null {
    const entry = this.#past.pop() ?? null;
    if (entry) this.#future.push(entry);
    return entry;
  }

  redo(): LayoutHistoryEntry | null {
    const entry = this.#future.pop() ?? null;
    if (entry) this.#past.push(entry);
    return entry;
  }

  clear(): void {
    this.#past = [];
    this.#future = [];
  }

  get canUndo(): boolean { return this.#past.length > 0; }
  get canRedo(): boolean { return this.#future.length > 0; }
  get depth(): number { return this.#past.length; }
}
