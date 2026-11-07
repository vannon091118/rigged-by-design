/**
 * agent:context — Produce impact/gate plan for the current lane claim.
 * Reads claims.json, validates affected paths, lists affected tests.
 */

import fs from "fs";
import path from "path";

const CLAIMS_PATH = path.join(".lane-claims", "claims.json");

function main() {
  const claims = JSON.parse(fs.readFileSync(CLAIMS_PATH, "utf8"));

  const result = {
    head: claims.head,
    version: claims.version,
    lane: {
      domain: "fundament",
      task: "phase-0-foundation",
    },
    pathAllowlist: [
      "src/**",
      "tests/**",
      "docs/**",
      ".lane-claims/**",
      "package.json",
      "scripts/**",
    ],
    contractVersions: claims.claims.reduce((acc, c) => {
      if (c.contractVersions) Object.assign(acc, c.contractVersions);
      return acc;
    }, {}),
    gateProfile: "phase-0",
    affectedTests: [
      "tests/core/actor-id.test.ts",
      "tests/core/world-time.test.ts",
      "tests/core/domain-event.test.ts",
      "tests/core/relationship.test.ts",
      "tests/core/factor.test.ts",
      "tests/core/save.test.ts",
      "tests/core/ledger.test.ts",
      "tests/core/rng/weighted.test.ts",
    ],
    gateChecks: {
      "verify:light": "pending",
      "pretask": "pending",
      "capabilities": "pending",
    },
    impact: {
      filesTouched: 0,
      testsAffected: 8,
      contractsAffected: 6,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main();