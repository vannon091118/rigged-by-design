/**
 * Furniture Definition Tests - Phase 7.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FurnitureDefinition,
  FurnitureDefinitionRegistry,
  furnitureDefinitionRegistry,
  registerStandardFurniture,
  registerFurnitureDefinition,
  getFurnitureDefinition,
  listFurnitureDefinitions,
} from "../../../../src/core/sim/room/furniture-definition";

describe("Furniture Definition Registry", () => {
  let registry: FurnitureDefinitionRegistry;

  beforeEach(() => {
    registry = new FurnitureDefinitionRegistry();
  });

  it("registers a furniture definition", () => {
    const result = registry.registerDefinition({
      id: "test-table",
      kind: "table",
      label: "Test Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 5000 },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects furniture with unknown role", () => {
    const result = registry.registerDefinition({
      id: "bad-table",
      kind: "table",
      label: "Bad Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { "nonexistent.role": 5000 },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid role weights");
  });

  it("rejects weight out of range", () => {
    const result = registry.registerDefinition({
      id: "bad-table",
      kind: "table",
      label: "Bad Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 15000 },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("out of range");
  });

  it("gets and lists definitions", () => {
    registry.registerDefinition({
      id: "test-table",
      kind: "table",
      label: "Test Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 5000 },
    });

    const def = registry.getDefinition("test-table");
    expect(def).toBeDefined();
    expect(def?.label).toBe("Test Table");

    const all = registry.listDefinitions();
    expect(all.length).toBe(1);
  });

  it("checks role weights", () => {
    registry.registerDefinition({
      id: "test-table",
      kind: "table",
      label: "Test Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 5000, gambling: 2000 },
    });

    expect(registry.hasRole("test-table", "social")).toBe(true);
    expect(registry.hasRole("test-table", "gambling")).toBe(true);
    expect(registry.hasRole("test-table", "food")).toBe(false);

    const roles = registry.getRolesForFurniture("test-table");
    expect(roles.length).toBe(2);
  });

  it("gets role weights", () => {
    registry.registerDefinition({
      id: "test-table",
      kind: "table",
      label: "Test Table",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 5000 },
    });

    const weights = registry.getRoleWeights("test-table");
    expect(weights?.["social"]).toBe(5000);
  });
});

describe("Global Furniture Registry", () => {
  it("registers standard furniture", () => {
    const result = registerStandardFurniture();
    expect(result.ok).toBe(true);
  });

  it("gets standard furniture", () => {
    registerStandardFurniture();
    const def = getFurnitureDefinition("slot-machine-01");
    expect(def).toBeDefined();
    expect(def?.kind).toBe("gaming-machine");
    expect(def?.roleWeightsBps["gambling"]).toBe(8000);
  });

  it("lists all furniture", () => {
    registerStandardFurniture();
    const all = listFurnitureDefinitions();
    expect(all.length).toBeGreaterThan(0);
  });
});
