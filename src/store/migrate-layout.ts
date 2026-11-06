/**
 * Layout-Migration: v11 liest den gespeicherten Plan, v5–v10 leiten ihn
 * deterministisch aus ihrer Vorlage ab. Ungueltige Plaene brechen ab, statt
 * halb in die Welt zu kommen.
 */
import { applyLayout, LayoutContractError } from '../core/sim/layout';
import { layoutFromTemplate } from '../core/sim/layout-derive';
import { parseLayout } from '../core/sim/layout-validate';
import type { TemplateId, WorldState } from '../core/sim/types';

interface SavedLayoutSource {
  readonly version: number;
  readonly template: TemplateId;
  readonly layout?: unknown;
}

export function hydrateLayout(world: WorldState, saved: SavedLayoutSource): void {
  if (saved.version < 11) {
    applyLayout(world, layoutFromTemplate(saved.template));
    return;
  }
  const parsed = parseLayout(saved.layout);
  if (!parsed.ok) throw new LayoutContractError(parsed.issues);
  const expected = layoutFromTemplate(saved.template);
  if (parsed.layout.size !== expected.size) {
    throw new LayoutContractError([
      `Layout-Groesse ${parsed.layout.size} passt nicht zur Vorlage ${saved.template} (${expected.size}).`,
    ]);
  }
  applyLayout(world, parsed.layout);
}
