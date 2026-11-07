import { describe, it, expect } from "vitest";
import { createSaveState, migrateState } from "../../src/core/save";

describe("Save contract", () => {
  it("creates a save state", () => {
    const state = createSaveState("1.0.0", 100, 1);
    expect(state.version).toBe("1.0.0");
    expect(state.worldTime.tick).toBe(100);
    expect(state.worldTime.day).toBe(1);
  });

  it("migrates through versions", () => {
    const migrations = [
      {
        fromVersion: "0.1.0",
        toVersion: "1.0.0",
        migrate: (state: unknown) => createSaveState("1.0.0", 0, 0),
      },
    ];
    const result = migrateState({ version: "0.1.0" } as any, migrations);
    expect(result?.version).toBe("1.0.0");
  });

  it("returns null for unknown version", () => {
    const result = migrateState({ version: "9.9.9" } as any, []);
    expect(result).toBeNull();
  });
});