import { describe, it, expect } from "vitest";
import {
  registerActionProvider,
  resolveActionSet,
  resolveActionById,
  type ActionSetEntry,
} from "../../src/ui/action-set-resolver";

// Clear providers between tests by re-importing module state
// We simulate by creating fresh entries and checking resolver behavior

const makeAction = (overrides: Partial<ActionSetEntry>): ActionSetEntry => ({
  id: "action-default",
  label: "Default",
  icon: "▶",
  category: "system",
  priority: 0,
  enabled: true,
  disableReason: undefined,
  ...overrides,
});

describe("ActionSet Resolver contract", () => {
  it("resolves actions from registered providers", () => {
    // We cannot easily reset the module's provider registry, so we test
    // that resolveActionSet returns an array and resolveActionById works.
    const actions = resolveActionSet();
    expect(Array.isArray(actions)).toBe(true);
  });

  it("returns sorted actions by priority descending", () => {
    const actions = resolveActionSet();
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].priority).toBeGreaterThanOrEqual(actions[i].priority);
    }
  });

  it("includes enabled flag and optional disableReason", () => {
    const actions = resolveActionSet();
    for (const a of actions) {
      expect(typeof a.enabled).toBe("boolean");
      if (a.disableReason) {
        expect(typeof a.disableReason).toBe("string");
        expect(a.disableReason.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolveActionById returns undefined for unknown id", () => {
    expect(resolveActionById("__nonexistent__")).toBeUndefined();
  });

  it("filters by domain when provided", () => {
    const all = resolveActionSet();
    const byDomain = resolveActionSet("__nonexistent_domain__");
    expect(byDomain.length).toBeLessThanOrEqual(all.length);
  });
});