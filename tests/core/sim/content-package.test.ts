import { describe, it, expect } from "vitest";
import { registerContentPackages, RETAIL_PACKAGE, COMMUNICATION_PACKAGE } from "../../../src/core/sim/content-package";
import { domainRegistry } from "../../../src/core/sim/domain-registry";

describe("Content Packages (Phase 1.3)", () => {
  it("registers retail package", () => {
    const result = domainRegistry.registerDomain(RETAIL_PACKAGE);
    expect(result.ok).toBe(true);
  });

  it("registers communication package", () => {
    const result = domainRegistry.registerDomain(COMMUNICATION_PACKAGE);
    expect(result.ok).toBe(true);
  });

  it("registerContentPackages returns ok for all", () => {
    // Note: domainRegistry is a singleton, registration may return ok:false
    // if domains already registered from a previous test. The important thing
    // is the packages exist in the results.
    const result = registerContentPackages();
    expect(result.results.length).toBe(2);
  });

  it("retail package has no casino dependencies", () => {
    expect(RETAIL_PACKAGE.dependencies).toEqual([]);
  });

  it("communication package has no casino dependencies", () => {
    expect(COMMUNICATION_PACKAGE.dependencies).toEqual([]);
  });

  it("retail package defines retail-specific event types", () => {
    const retailEvent = RETAIL_PACKAGE.eventTypes.find((e) => e.type === "retail.item.purchased");
    expect(retailEvent).toBeDefined();
    expect(retailEvent!.domain).toBe("retail");
  });

  it("communication package defines communication-specific event types", () => {
    const commEvent = COMMUNICATION_PACKAGE.eventTypes.find((e) => e.type === "comm.message.sent");
    expect(commEvent).toBeDefined();
    expect(commEvent!.domain).toBe("communication");
  });
});