/** Der einzige Schreibpfad der raeumlichen Wahrheit: Layout zuerst, Sicht abgeleitet. */
import { zonesFromLayout } from './layout-derive';
import type { LayoutState } from './layout-types';
import type { WorldState } from './types';

/** Ungueltige Layout-Daten brechen kontrolliert ab, bevor sie die Welt erreichen. */
export class LayoutContractError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Layout ungueltig: ${issues.join(' ')}`);
    this.name = 'LayoutContractError';
    this.issues = issues;
  }
}

/**
 * Setzt die kanonische Wahrheit und zieht die Legacy-Sicht nach. `size` und
 * `zones` werden nirgendwo sonst geschrieben, damit sie nicht auseinanderlaufen.
 */
export function applyLayout(world: WorldState, layout: LayoutState): void {
  world.layout = layout;
  world.size = layout.size;
  world.zones = zonesFromLayout(layout);
}
