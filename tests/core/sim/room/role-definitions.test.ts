/**
 * Role Definitions Tests - Phase 7.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerStandardRoles,
  STANDARD_ROLES,
  isValidRole,
  listAllRoles,
  getRoleDomain,
} from "../../../../src/core/sim/room/role-definitions";

describe("Role Definitions", () => {
  it("has standard roles", () => {
    expect(STANDARD_ROLES.length).toBeGreaterThan(0);
    const roleIds = STANDARD_ROLES.map((r) => r.id);
    expect(roleIds).toContain("gambling");
    expect(roleIds).toContain("drinks");
    expect(roleIds).toContain("food");
    expect(roleIds).toContain("retail");
    expect(roleIds).toContain("retail.clothing");
    expect(roleIds).toContain("social");
  });

  it("registers standard roles", () => {
    const result = registerStandardRoles();
    expect(result.ok).toBe(true);
  });

  it("validates known role", () => {
    expect(isValidRole("gambling")).toBe(true);
    expect(isValidRole("food")).toBe(true);
  });

  it("rejects unknown role", () => {
    expect(isValidRole("nonexistent")).toBe(false);
  });

  it("lists all roles", () => {
    const roles = listAllRoles();
    expect(roles.length).toBeGreaterThan(0);
  });

  it("gets role domain", () => {
    expect(getRoleDomain("gambling")).toBe("casino");
    expect(getRoleDomain("food")).toBe("hospitality");
    expect(getRoleDomain("nonexistent")).toBeUndefined();
  });
});
