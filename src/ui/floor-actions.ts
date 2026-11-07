/**
 * Floor actions — previously used central If/Else branching.
 * Now delegates to the ActionSet resolver (Phase 0.6).
 * No more If/Else central branching; all actions come from registered providers.
 */

import { resolveActionSet, resolveActionById } from "./action-set-resolver";

// Legacy If/Else central branching — REMOVED.
// All floor actions are now resolved via ActionSet providers.

export function listFloorActions(domain?: string): ReturnType<typeof resolveActionSet> {
  return resolveActionSet(domain);
}

export function getFloorAction(actionId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return resolveActionById(actionId);
}