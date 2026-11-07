/**
 * Job context menu — renders from the shared ActionSet contract.
 * Phase 0.6: no second menu system parallel to ActionSet.
 * All menu entries come from registered Action providers via the resolver.
 */

import { resolveActionSet } from "./action-set-resolver";
import type { ActionSetEntry } from "./action-card";

export interface JobContextMenuProps {
  readonly domain: string;
  readonly onExecute: (actionId: string) => void;
}

export function JobContextMenu(props: JobContextMenuProps): string {
  const { domain, onExecute } = props;
  const actions = resolveActionSet(domain);

  // Radial menu for up to 6 entries, dropdown sheet for 7+
  const useRadial = actions.length <= 6;

  if (useRadial) {
    return renderRadialMenu(actions, onExecute);
  }
  return renderDropdownSheet(actions, onExecute);
}

function renderRadialMenu(actions: ActionSetEntry[], onExecute: (id: string) => void): string {
  const items = actions
    .map(
      (a) => `<li data-action="${a.id}"${a.enabled ? "" : ' disabled'}
        title="${a.label}${a.disableReason ? ` — ${a.disableReason}` : ""}">
        ${a.icon ? `[${a.icon}]` : ""}${a.label}
      </li>`
    )
    .join("");
  return `<ul class="radial-menu">${items}</ul>`;
}

function renderDropdownSheet(actions: ActionSetEntry[], onExecute: (id: string) => void): string {
  const items = actions
    .map(
      (a) => `<div class="dropdown-item" data-action="${a.id}"${a.enabled ? "" : ' disabled'}
        title="${a.label}${a.disableReason ? ` — ${a.disableReason}` : ""}">
        ${a.icon ? `[${a.icon}]` : ""}${a.label}
      </div>`
    )
    .join("");
  return `<div class="dropdown-sheet">${items}</div>`;
}