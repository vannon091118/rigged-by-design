/**
 * Layout-Export und -Import am Store-Rand. Der Import prueft das Dokument
 * fail-closed und zusaetzlich die Rastergroesse gegen die aktive Vorlage,
 * bevor der Store das Layout uebernimmt.
 */
import { layoutFromTemplate } from '../core/sim/layout-derive';
import { exportLayout, importLayout } from '../core/sim/layout-json';
import type { LayoutState } from '../core/sim/layout-types';
import type { WorldState } from '../core/sim/types';

interface LayoutTransferDeps {
  readonly apply: (layout: LayoutState) => void;
  readonly reset: () => void;
  readonly notice: (text: string) => void;
  readonly emit: (save: boolean) => void;
}

export class LayoutTransfer {
  readonly #world: () => WorldState;
  readonly #deps: LayoutTransferDeps;

  constructor(world: () => WorldState, deps: LayoutTransferDeps) {
    this.#world = world;
    this.#deps = deps;
  }

  export(): string {
    return exportLayout(this.#world().layout);
  }

  import(text: string): { readonly ok: boolean; readonly issues: readonly string[] } {
    const world = this.#world();
    const result = importLayout(text);
    if (!result.ok) {
      this.#reject(result.issues);
      return result;
    }
    const expected = layoutFromTemplate(world.template).size;
    if (result.layout.size !== expected) {
      const issues = [`Layout-Groesse ${result.layout.size} passt nicht zur Vorlage ${world.template} (${expected}).`];
      this.#reject(issues);
      return { ok: false, issues };
    }
    this.#deps.apply(result.layout);
    this.#deps.reset();
    this.#deps.notice('Layout importiert.');
    this.#deps.emit(true);
    return { ok: true, issues: [] };
  }

  #reject(issues: readonly string[]): void {
    this.#deps.notice(issues[0] ?? 'Layout-Import abgelehnt.');
    this.#deps.emit(false);
  }
}
