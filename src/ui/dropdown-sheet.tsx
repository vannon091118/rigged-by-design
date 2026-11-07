/**
 * Dropdown sheet UI component — renders 7+ ActionSet entries.
 * Shared ActionSet contract (Phase 0.6).
 */

import type { ActionSetEntry } from "./action-set-entry";

export function DropdownSheet(props: {
  readonly actions: ActionSetEntry[];
  readonly onExecute: (actionId: string) => void;
}): string {
  const { actions } = props;
  if (actions.length < 7) {
    throw new Error("DropdownSheet is for 7+ entries; use RadialMenu for 6 or fewer");
  }

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