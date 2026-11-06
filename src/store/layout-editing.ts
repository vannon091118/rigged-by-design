/**
 * Editor-Verlauf am Store-Rand: typisierte Commands anwenden, Pinselstriche
 * gruppieren und 30 Schritte rückgängig machen. Die Welt bleibt der einzige
 * Besitzer des Layouts; dieses Modul fordert nur Lesen, Schreiben und Melden an.
 */
import { applyLayoutCommand, type LayoutCommand } from '../core/sim/layout-commands';
import { LayoutHistory } from '../core/sim/layout-history';
import type { LayoutState } from '../core/sim/layout-types';

interface LayoutEditorDeps {
  readonly layout: () => LayoutState;
  readonly apply: (layout: LayoutState) => void;
  readonly emit: (save: boolean) => void;
  readonly notice: (text: string) => void;
}

const label = (command: LayoutCommand): string => {
  if (command.kind === 'FLOOR') return `Boden ${command.material}`;
  return command.edge === 'NONE' ? 'Kante entfernt' : `Kante ${command.edge}`;
};

export class LayoutEditor {
  readonly #deps: LayoutEditorDeps;
  readonly #history = new LayoutHistory(30);
  #stroke: { readonly label: string; readonly before: LayoutState } | null = null;

  constructor(deps: LayoutEditorDeps) {
    this.#deps = deps;
  }

  begin(strokeLabel = 'Pinselstrich'): void {
    this.#stroke ??= { label: strokeLabel, before: this.#deps.layout() };
  }

  paint(command: LayoutCommand): boolean {
    const before = this.#deps.layout();
    try {
      const next = applyLayoutCommand(before, command);
      if (next === before) return true;
      this.#deps.apply(next);
      // Waehrend eines Strichs waechst nur der offene Schritt, nicht die Historie.
      if (!this.#stroke) this.#history.push({ label: label(command), before, after: next });
      this.#deps.notice(command.kind === 'FLOOR' ? 'Boden gemalt.' : 'Kante gesetzt.');
      this.#deps.emit(this.#stroke === null);
      return true;
    } catch (error) {
      this.#deps.notice(error instanceof Error ? error.message : 'Layout-Aenderung abgelehnt.');
      this.#deps.emit(false);
      return false;
    }
  }

  end(): void {
    const stroke = this.#stroke;
    this.#stroke = null;
    if (!stroke) return;
    if (this.#deps.layout() !== stroke.before) {
      this.#history.push({ label: stroke.label, before: stroke.before, after: this.#deps.layout() });
    }
    this.#deps.emit(true);
  }

  undo(): boolean {
    this.#stroke = null;
    const step = this.#history.undo();
    if (!step) return false;
    this.#deps.apply(step.before);
    this.#deps.notice(`Rückgängig: ${step.label}.`);
    this.#deps.emit(true);
    return true;
  }

  redo(): boolean {
    this.#stroke = null;
    const step = this.#history.redo();
    if (!step) return false;
    this.#deps.apply(step.after);
    this.#deps.notice(`Wiederhergestellt: ${step.label}.`);
    this.#deps.emit(true);
    return true;
  }

  reset(): void {
    this.#history.clear();
    this.#stroke = null;
  }
}
