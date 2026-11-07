/**
 * ActionSet UI contract: a single action rendered as a card.
 * Part of the ActionSet contract (v1.0.0) — Phase 0.6.
 */

export interface ActionSetEntry {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly category: "movement" | "interaction" | "social" | "economic" | "system";
  readonly priority: number; // higher = shown first
  readonly enabled: boolean;
  readonly disableReason?: string; // machine-readable reason when disabled
}

export interface ActionCardProps {
  readonly action: ActionSetEntry;
  readonly onExecute: (actionId: string) => void;
}

export function ActionCard(props: ActionCardProps): string {
  const { action, onExecute } = props;
  const disabled = !action.enabled;
  const reason = action.disableReason ? ` (${action.disableReason})` : "";
  return `<button${disabled ? " disabled" : ""} onclick="onExecute('${action.id}')" title="${action.label}${reason}">
    ${action.icon ? `[${action.icon}]` : ""}${action.label}
  </button>`;
}