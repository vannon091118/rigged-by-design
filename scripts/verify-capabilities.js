/**
 * verify:capabilities — Validate capability manifest.
 * Checks:
 * 1. Schema/IDs valid
 * 2. Active capability without test is rejected
 * 3. Test IDs actually exist
 * 4. Outdated path references reported
 * 5. Tombstones/Replacement parity evidence checked
 */

import fs from "fs";
import path from "path";

const CAPS_PATH = path.join("docs", "capabilities.json");

function main() {
  let caps;
  try {
    caps = JSON.parse(fs.readFileSync(CAPS_PATH, "utf8"));
  } catch (e) {
    console.error(`[RED] capabilities.json not found or invalid: ${e.message}`);
    process.exit(1);
  }

  let errors = 0;
  let warnings = 0;

  console.log(`=== verify:capabilities ===`);
  console.log(`Schema: ${caps.schema}, Version: ${caps.version}`);
  console.log(`Capabilities: ${caps.capabilities.length}\n`);

  // 1. Schema/IDs valid
  const seenIds = new Set();
  for (const cap of caps.capabilities) {
    if (!cap.id || typeof cap.id !== "string") {
      console.log(`[RED] Capability missing id`);
      errors++;
      continue;
    }
    if (seenIds.has(cap.id)) {
      console.log(`[RED] Duplicate capability id: ${cap.id}`);
      errors++;
    }
    seenIds.add(cap.id);

    if (!cap.domain) {
      console.log(`[RED] ${cap.id}: missing domain`);
      errors++;
    }
    if (!cap.status) {
      console.log(`[RED] ${cap.id}: missing status`);
      errors++;
    }
    if (!Array.isArray(cap.paths)) {
      console.log(`[RED] ${cap.id}: paths must be array`);
      errors++;
    }
    if (!Array.isArray(cap.testIds)) {
      console.log(`[RED] ${cap.id}: testIds must be array`);
      errors++;
    }

    // 2. Active capability without test is rejected
    if (cap.status === "active" && (!cap.testIds || cap.testIds.length === 0)) {
      console.log(`[RED] ${cap.id}: active capability has no test IDs`);
      errors++;
    }

    // 3. Test IDs actually exist
    for (const testId of cap.testIds || []) {
      if (!fs.existsSync(testId)) {
        console.log(`[RED] ${cap.id}: test not found: ${testId}`);
        errors++;
      }
    }

    // 4. Outdated path references reported
    for (const p of cap.paths || []) {
      if (!fs.existsSync(p)) {
        console.log(`[WARN] ${cap.id}: outdated path reference: ${p}`);
        warnings++;
      }
    }

    // 5. Tombstone/Replacement parity
    if (cap.tombstone) {
      if (!cap.replacement) {
        console.log(`[RED] ${cap.id}: tombstoned but no replacement`);
        errors++;
      }
    }
  }

  // Summary
  const activeCaps = caps.capabilities.filter((c) => c.status === "active").length;
  const mergedCaps = caps.capabilities.filter((c) => c.status === "merged").length;
  const baselineCaps = caps.capabilities.filter((c) => c.status === "baseline-candidate").length;

  console.log(`\n=== Summary ===`);
  console.log(`Active: ${activeCaps}, Merged: ${mergedCaps}, Baseline-candidate: ${baselineCaps}`);
  console.log(`Errors: ${errors}, Warnings: ${warnings}`);

  if (errors > 0) {
    console.log(`\n[RED] verify:capabilities FAILED`);
    process.exit(1);
  }

  console.log(`\n[GREEN] verify:capabilities PASSED`);
  process.exit(0);
}

main();