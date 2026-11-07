import { describe, it, expect } from "vitest";
import { roleManifest, BUILTIN_ROLES, type RoleWeightEntry } from "../../../src/core/sim/role-manifest";

describe("Role Manifest (Phase 1.3)", () => {
  it("has built-in extensible roles", () => {
    expect(BUILTIN_ROLES.length).toBeGreaterThan(0);
    const roleIds = BUILTIN_ROLES.map((r) => r.id);
    expect(roleIds).toContain("gambling");
    expect(roleIds).toContain("drinks");
    expect(roleIds).toContain("food");
    expect(roleIds).toContain("retail");
    expect(roleIds).toContain("retail.clothing");
    expect(roleIds).toContain("social");
  });

  it("lists roles", () => {
    const roles = roleManifest.listRoles();
    expect(roles.length).toBeGreaterThanOrEqual(6);
  });

  it("registers a new extensible role", () => {
    const result = roleManifest.registerRole({
      id: "test.custom-role",
      label: "Custom Role",
      domain: "test",
      version: "1.0.0",
      description: "A test role",
    });
    expect(result.ok).toBe(true);
    expect(roleManifest.getRole("test.custom-role")).toBeDefined();
  });

  it("rejects duplicate role registration (idempotent - returns existing)", () => {
    const result = roleManifest.registerRole({
      id: "gambling",
      label: "Duplicate",
      domain: "casino",
      version: "1.0.0",
      description: "Duplicate",
    });
    expect(result.ok).toBe(true);
    expect(result.role?.id).toBe("gambling");
  });

  it("sets object role vector with fixed-point weights", () => {
    const entries: RoleWeightEntry[] = [
      { roleId: "retail", weightBps: 3000 },
      { roleId: "social", weightBps: 7000 },
    ];
    const result = roleManifest.setObjectRoleVector("obj-1", entries);
    expect(result.ok).toBe(true);
    expect(roleManifest.getWeight("obj-1", "retail")).toBe(3000);
    expect(roleManifest.getWeight("obj-1", "social")).toBe(7000);
  });

  it("rejects weight out of range", () => {
    const result = roleManifest.setObjectRoleVector("obj-2", [
      { roleId: "retail", weightBps: 15000 },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown roleId", () => {
    const result = roleManifest.setObjectRoleVector("obj-3", [
      { roleId: "unknown.role", weightBps: 100 },
    ]);
    expect(result.ok).toBe(false);
  });

  it("returns zero weight for unset role", () => {
    expect(roleManifest.getWeight("obj-1", "gambling")).toBe(0);
  });

  it("role IDs are open and extensible", () => {
    // Any domain can add new roles
    const before = roleManifest.listRoles().length;
    roleManifest.registerRole({
      id: "custom.new-role",
      label: "New Role",
      domain: "custom",
      version: "1.0.0",
      description: "Extensible role",
    });
    const after = roleManifest.listRoles().length;
    expect(after).toBe(before + 1);
  });
});