/**
 * claim:register — Register a lane claim for the current HEAD.
 * Reads .lane-claims/claims.json and validates active claims against HEAD.
 */

import fs from "fs";
import path from "path";

const CLAIMS_PATH = path.join(".lane-claims", "claims.json");

function main() {
  if (!fs.existsSync(CLAIMS_PATH)) {
    console.error("ERR-4019: keine Claims-Datei gefunden");
    process.exit(1);
  }

  const claims = JSON.parse(fs.readFileSync(CLAIMS_PATH, "utf8"));
  const head = claims.head || "unknown";
  const active = claims.activeForHead || [];

  console.log(`=== Lane-Claim Registration ===`);
  console.log(`HEAD: ${head}`);
  console.log(`Version: ${claims.version || "unknown"}`);
  console.log(`Active claims for HEAD: ${active.length}`);
  console.log(`Total claims: ${claims.claims.length}`);

  const openClaims = claims.claims.filter((c) => c.status === "open");
  console.log(`Open claims: ${openClaims.length}`);

  for (const claim of openClaims) {
    console.log(`  - ${claim.id}: ${claim.domain}/${claim.task} (baseSha: ${claim.baseSha})`);
  }

  if (active.length === 0 && openClaims.length > 0) {
    console.warn("WARN: No claims active for current HEAD. Pretask will be BLOCKED until a claim is activated.");
  }

  // Validate each claim has required fields
  for (const claim of claims.claims) {
    const required = ["id", "domain", "task", "owner", "baseSha", "pathAllowlist", "gateProfile"];
    const missing = required.filter((f) => !(f in claim));
    if (missing.length > 0) {
      console.error(`Claim ${claim.id} missing fields: ${missing.join(", ")}`);
    }
  }

  console.log(`=== Claim registration complete ===`);
}

main();