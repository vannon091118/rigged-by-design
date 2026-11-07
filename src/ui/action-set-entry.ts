/**
 * ActionSet entry contract (v1.0.0) — Phase 0.6.
 * The data shape lives in its own module so the ActionCard React component
 * stays the UI renderer and does not become a second domain model.
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
