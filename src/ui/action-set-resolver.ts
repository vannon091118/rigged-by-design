/**
 * ActionSet Resolver — central resolver for UI actions.
 * Replaces the If/Else central branching in floor-actions.ts.
 * Phase 0.6: ActionSet as versioned UI/Domain contract.
 */

import type { ActionSetEntry } from "./action-card";

export interface ActionProvider {
  readonly domain: string;
  readonly actions: () => ActionSetEntry[];
}

const providers: ActionProvider[] = [];

export function registerActionProvider(provider: ActionProvider): void {
  providers.push(provider);
  providers.sort((a, b) => a.domain.localeCompare(b.domain));
}

export function resolveActionSet(domain?: string): ActionSetEntry[] {
  let all: ActionSetEntry[] = [];
  for (const p of providers) {
    if (!domain || p.domain === domain) {
      all = all.concat(p.actions());
    }
  }
  // Sort by priority descending, then by id ascending
  all.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return all;
}

export function resolveActionById(actionId: string): ActionSetEntry | undefined {
  for (const p of providers) {
    const found = p.actions().find((a) => a.id === actionId);
    if (found) return found;
  }
  return undefined;
}