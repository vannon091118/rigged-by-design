/**
 * Radial menu UI component — renders up to 6 ActionSet entries.
 * Shared ActionSet contract (Phase 0.6).
 */

import type { ActionSetEntry } from "./action-set-entry";

export function RadialMenu(props: {
  readonly actions: ActionSetEntry[];
  readonly onExecute: (actionId: string) => void;
}): string {
  const { actions } = props;
  if (actions.length > 6) {
    throw new Error("RadialMenu supports at most 6 entries; use DropdownSheet for 7+");
  }

  const items = actions
    .map(
      (a) => `<li data-action="${a.id}"${a.enabled ? "" : ' disabled'}
        style="--angle: var(--angle-${a.id})"
        title="${a.label}${a.disableReason ? ` — ${a.disableReason}` : ""}">
        ${a.icon ? `[${a.icon}]` : ""}${a.label}
      </li>`
    )
    .join("");

  return `<ul class="radial-menu">${items}</ul>`;
}