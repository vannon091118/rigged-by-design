/**
 * Contract: Save (v1.0.0)
 * Save/migration contract for world state persistence.
 * Merged in Phase 0.5 as a baseline contract.
 */

export interface SaveState {
  readonly version: string;
  readonly worldTime: { tick: number; day: number };
  readonly actors: Record<string, unknown>;
  readonly relationships: Record<string, unknown>;
  readonly events: Record<string, unknown>;
  readonly ledger: Record<string, unknown>;
}

export interface Migration {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly migrate: (state: unknown) => SaveState;
}

export function createSaveState(
  version: string,
  tick: number,
  day: number
): SaveState {
  return {
    version,
    worldTime: { tick, day },
    actors: {},
    relationships: {},
    events: {},
    ledger: {},
  };
}

export function migrateState(
  state: unknown,
  migrations: Migration[]
): SaveState | null {
  const current = state as { version?: string } | null;
  if (!current || !current.version) return null;

  let working = current;
  let migrated = false;
  for (const m of migrations) {
    if (m.fromVersion === working.version) {
      working = m.migrate(working);
      migrated = true;
    }
  }
  if (!migrated) return null;
  return working as SaveState;
}