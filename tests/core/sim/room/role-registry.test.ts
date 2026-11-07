/**
 * Role Registry Tests - Phase 7.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoleRegistry, roleRegistry } from "../../../../src/core/sim/room/role-registry";

describe("Role Registry", () => {
  let registry: RoleRegistry;

  beforeEach(() => {
    registry = new RoleRegistry();
    registry.registerDomain("casino", "casino-owner", "1.0.0");
    registry.registerDomain("social", "social-owner", "1.0.0");
  });

  it("registers a domain", () => {
    const result = registry.registerDomain("retail", "retail-owner", "1.0.0");
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate domain", () => {
    const result = registry.registerDomain("casino", "other", "1.0.0");
    expect(result.ok).toBe(false);
  });

  it("registers a role with valid domain", () => {
    const result = registry.registerRole({
      id: "gambling",
      label: "Gambling",
      domain: "casino",
      version: "1.0.0",
      description: "Gambling object",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects role with unknown domain", () => {
    const result = registry.registerRole({
      id: "unknown",
      label: "Unknown",
      domain: "nonexistent",
      version: "1.0.0",
      description: "Test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown domain");
  });

  it("rejects role with version mismatch", () => {
    const result = registry.registerRole({
      id: "test-role",
      label: "Test",
      domain: "casino",
      version: "2.0.0",
      description: "Test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Version mismatch");
  });

  it("validates known role", () => {
    registry.registerRole({
      id: "test-role",
      label: "Test",
      domain: "casino",
      version: "1.0.0",
      description: "Test",
    });
    const result = registry.validateRole("test-role");
    expect(result.ok).toBe(true);
  });

  it("rejects unknown role", () => {
    const result = registry.validateRole("nonexistent-role");
    expect(result.ok).toBe(false);
  });

  it("lists domains", () => {
    const domains = registry.listDomains();
    expect(domains.length).toBe(2);
  });
});

describe("Global Role Registry", () => {
  it("has casino domain registered", () => {
    const domain = roleRegistry.getDomain("casino");
    expect(domain).toBeDefined();
    expect(domain?.owner).toBe("casino-domain");
  });
});
