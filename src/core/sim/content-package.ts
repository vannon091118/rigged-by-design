/**
 * Content Package — Minimal non-casino package example (Retail).
 * Phase 1.3: Demonstrates how a domain registers itself via manifest.
 */

import { domainRegistry } from "./domain-registry";
import { roleManifest, BUILTIN_ROLES } from "./role-manifest";

// Retail content package manifest
const RETAIL_PACKAGE = {
  domainId: "retail",
  version: "1.0.0",
  eventTypes: [
    { type: "retail.item.purchased", domain: "retail", description: "A retail item was purchased", version: "1.0.0" },
    { type: "retail.stock.changed", domain: "retail", description: "Retail stock level changed", version: "1.0.0" },
  ],
  factorContributions: [
    { factorId: "retail.discount", domain: "retail", defaultWeight: 0, applicableTo: ["item", "store"] },
    { factorId: "retail.loyalty", domain: "retail", defaultWeight: 0, applicableTo: ["customer"] },
  ],
  consequenceCommands: [
    { command: "retail.apply-discount", domain: "retail", description: "Apply discount to purchase", version: "1.0.0" },
    { command: "retail.restock", domain: "retail", description: "Restock retail item", version: "1.0.0" },
  ],
  narrativePools: ["retail.greeting", "retail.farewell"],
  dependencies: [], // no dependencies — standalone non-casino package
} as const;

// Communication content package manifest (another non-casino example)
const COMMUNICATION_PACKAGE = {
  domainId: "communication",
  version: "1.0.0",
  eventTypes: [
    { type: "comm.message.sent", domain: "communication", description: "A message was sent", version: "1.0.0" },
    { type: "comm.message.received", domain: "communication", description: "A message was received", version: "1.0.0" },
  ],
  factorContributions: [
    { factorId: "comm.urgency", domain: "communication", defaultWeight: 0, applicableTo: ["message"] },
  ],
  consequenceCommands: [
    { command: "comm.send-message", domain: "communication", description: "Send a message", version: "1.0.0" },
  ],
  narrativePools: ["comm.greeting"],
  dependencies: [],
} as const;

export function registerContentPackages(): { ok: boolean; results: Array<{ package: string; ok: boolean; errors: string[] }> } {
  const results: Array<{ package: string; ok: boolean; errors: string[] }> = [];

  const retailResult = domainRegistry.registerDomain(RETAIL_PACKAGE);
  results.push({ package: "retail", ok: retailResult.ok, errors: retailResult.errors });

  const commResult = domainRegistry.registerDomain(COMMUNICATION_PACKAGE);
  results.push({ package: "communication", ok: commResult.ok, errors: commResult.errors });

  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

export { RETAIL_PACKAGE, COMMUNICATION_PACKAGE };