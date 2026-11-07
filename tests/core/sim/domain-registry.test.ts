import { describe, it, expect } from "vitest";
import { domainRegistry } from "../../../src/core/sim/domain-registry";
import { RETAIL_PACKAGE, COMMUNICATION_PACKAGE } from "../../../src/core/sim/content-package";

describe("Domain Registry (Phase 1.3)", () => {
  it("registers a domain manifest", () => {
    const result = domainRegistry.registerDomain(RETAIL_PACKAGE);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects duplicate domain registration", () => {
    const result = domainRegistry.registerDomain(RETAIL_PACKAGE);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("already registered"))).toBe(true);
  });

  it("retrieves a registered domain", () => {
    const domain = domainRegistry.getDomain("retail");
    expect(domain).toBeDefined();
    expect(domain!.domainId).toBe("retail");
    expect(domain!.version).toBe("1.0.0");
  });

  it("lists all registered domains", () => {
    const domains = domainRegistry.listDomains();
    expect(domains.length).toBeGreaterThanOrEqual(1);
  });

  it("registers and retrieves event types", () => {
    const evt = domainRegistry.getEventType("retail.item.purchased");
    expect(evt).toBeDefined();
    expect(evt!.domain).toBe("retail");
  });

  it("validates compatibility — unknown dependency is reported", () => {
    const validation = domainRegistry.validateCompatibility({
      domainId: "test-dep",
      version: "1.0.0",
      eventTypes: [],
      factorContributions: [],
      consequenceCommands: [],
      narrativePools: [],
      dependencies: ["nonexistent-domain"],
    });
    expect(validation.compatible).toBe(false);
    expect(validation.issues.some((i) => i.includes("nonexistent-domain"))).toBe(true);
  });

  it("communication package can be registered independently", () => {
    const result = domainRegistry.registerDomain(COMMUNICATION_PACKAGE);
    expect(result.ok).toBe(true);
    expect(domainRegistry.getDomain("communication")).toBeDefined();
  });

  it("non-casino packages have no casino dependencies", () => {
    const retail = domainRegistry.getDomain("retail");
    expect(retail!.dependencies).toEqual([]);
    const comm = domainRegistry.getDomain("communication");
    expect(comm!.dependencies).toEqual([]);
  });
});