/**
 * agent:pretask — Check pretask readiness.
 * Exits with code 0 if not BLOCKED, non-zero if BLOCKED (ERR-4019).
 * Output JSON with status and details.
 */

import fs from "fs";
import path from "path";

const CLAIMS_PATH = path.join(".lane-claims", "claims.json");

function main() {
  let claims;
  try {
    claims = JSON.parse(fs.readFileSync(CLAIMS_PATH, "utf8"));
  } catch (e) {
    console.error(JSON.stringify({ status: "BLOCKED", reason: "ERR-4019: claims.json not found or invalid" }));
    process.exit(1);
  }

  const head = claims.head || "unknown";
  const active = claims.activeForHead || [];
  const blockedReasons = claims.blockedReasons || [];

  const result = {
    head,
    version: claims.version || "unknown",
    activeClaims: active.length,
    blockedReasons,
    status: active.length > 0 && blockedReasons.length === 0 ? "READY" : "BLOCKED",
  };

  console.log(JSON.stringify(result, null, 2));

  if (result.status === "BLOCKED") {
    process.exit(1);
  }
}

main();