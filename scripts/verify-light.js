/**
 * verify:light — Run all lightweight verification gates.
 * Exits 0 if all green, non-zero if any gate is red.
 */

import { execSync } from "child_process";

let allGreen = true;

function run(name, cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    console.log(`[GREEN] ${name}`);
  } catch (e) {
    console.log(`[RED] ${name}: ${e.message}`);
    allGreen = false;
  }
}

console.log("=== verify:light ===\n");

// Gate 1: All core source files exist
const fs = await import("fs");
const path = await import("path");
const coreFiles = [
  "src/core/actor-id.ts",
  "src/core/world-time.ts",
  "src/core/domain-event.ts",
  "src/core/relationship.ts",
  "src/core/factor.ts",
  "src/core/save.ts",
  "src/core/ledger.ts",
  "src/core/rng/weighted.ts",
  "src/core/sim/worldtime.ts",
  "src/core/sim/calendar.ts",
  "src/core/sim/time-domain.ts",
  "src/core/sim/clock-adapter.ts",
  "src/core/sim/domain-registry.ts",
  "src/core/sim/role-manifest.ts",
  "src/core/sim/content-package.ts",
  "src/core/sim/event-bus.ts",
  "src/core/sim/event-consumer.ts",
  "src/core/sim/scheduler.ts",
  "src/core/actor-registry.ts",
  "src/core/visitor-presence.ts",
  "src/core/factor-catalog.ts",
  "src/core/factor-normalizer.ts",
  "src/core/factor-resolver.ts",
  "src/core/factor-policy.ts",
  "src/core/relationship-engine.ts",
  "src/core/relationship-apply.ts",
  "src/core/narrative-engine.ts",
  "src/core/narrative-memory.ts",
  "src/core/narrative-compiler.ts",
  "src/core/communication.ts",
  "src/core/communication-view.ts",
  "src/core/casino-integration.ts",
  "src/core/ego-network.ts",
  "src/core/influence-inspector.ts",
  "src/core/relationship-profile.ts",
  "src/core/social-view.ts",
  "src/core/sim/layout/wall.ts",
  "src/core/sim/layout/nav-grid.ts",
  "src/core/sim/layout/layout-editor.ts",
  "src/core/sim/layout/layout-from-template.ts",
  "src/core/sim/layout/room-id-stabilization.ts",
  "src/core/sim/layout/wall-collision.ts",
  "src/core/sim/layout/wall-navigation.ts",
  "src/core/sim/layout/wall-occlusion.ts",
  "src/core/sim/layout/door-passage.ts",
  "src/core/sim/room/role-registry.ts",
  "src/core/sim/room/role-definitions.ts",
  "src/core/sim/room/furniture-definition.ts",
  "src/core/sim/room/room-profile.ts",
  "src/core/sim/room/room-cache.ts",
  "src/core/sim/room/npc-perception.ts",
  "src/core/sim/room/public-identity.ts",
  "src/core/sim/room/access-policy.ts",
  "src/render/wall/wall-renderer.ts",
  "src/ui/layout-editor/layout-editor.tsx",
  "src/ui/action-set-resolver.ts",
  "src/ui/floor-actions.ts",
  "src/ui/job-context-menu.tsx",
  "src/ui/radial-menu.tsx",
  "src/ui/dropdown-sheet.tsx",
];

let missing = 0;
for (const f of coreFiles) {
  if (fs.existsSync(f)) {
    console.log(`[GREEN] source exists: ${f}`);
  } else {
    console.log(`[RED] source missing: ${f}`);
    missing++;
    allGreen = false;
  }
}

// Gate 2: All test files exist
const testFiles = [
  "tests/core/actor-id.test.ts",
  "tests/core/world-time.test.ts",
  "tests/core/domain-event.test.ts",
  "tests/core/relationship.test.ts",
  "tests/core/factor.test.ts",
  "tests/core/save.test.ts",
  "tests/core/ledger.test.ts",
  "tests/core/rng/weighted.test.ts",
  "tests/core/action-set-resolver.test.ts",
  "tests/core/sim/worldtime.test.ts",
  "tests/core/sim/calendar.test.ts",
  "tests/core/sim/time-domain.test.ts",
  "tests/core/sim/clock-adapter.test.ts",
  "tests/core/sim/domain-registry.test.ts",
  "tests/core/sim/role-manifest.test.ts",
  "tests/core/sim/content-package.test.ts",
  "tests/core/actor-registry.test.ts",
  "tests/core/sim/event-consumer.test.ts",
  "tests/core/sim/scheduler.test.ts",
  "tests/core/factor-catalog.test.ts",
  "tests/core/factor-normalizer.test.ts",
  "tests/core/factor-resolver.test.ts",
  "tests/core/factor-policy.test.ts",
  "tests/core/relationship-engine.test.ts",
  "tests/core/relationship-apply.test.ts",
  "tests/core/narrative-engine.test.ts",
  "tests/core/narrative-memory.test.ts",
  "tests/core/narrative-compiler.test.ts",
  "tests/core/narrative-memory-acceptance.test.ts",
  "tests/core/communication.test.ts",
  "tests/core/casino-integration.test.ts",
  "tests/core/social-view.test.ts",
  "tests/core/sim/layout/wall.test.ts",
  "tests/core/sim/layout/nav-grid.test.ts",
  "tests/core/sim/layout/layout-editor.test.ts",
  "tests/core/sim/layout/layout-from-template.test.ts",
  "tests/core/sim/layout/wall-collision.test.ts",
  "tests/core/sim/layout/wall-navigation.test.ts",
  "tests/core/sim/layout/wall-occlusion.test.ts",
  "tests/core/sim/layout/door-passage.test.ts",
  "tests/core/sim/layout/room-id-stabilization.test.ts",
  "tests/core/sim/room/role-registry.test.ts",
  "tests/core/sim/room/role-definitions.test.ts",
  "tests/core/sim/room/furniture-definition.test.ts",
  "tests/core/sim/room/room-profile.test.ts",
  "tests/core/sim/room/room-cache.test.ts",
  "tests/core/sim/room/npc-perception.test.ts",
  "tests/core/sim/room/public-identity.test.ts",
  "tests/core/sim/room/access-policy.test.ts",
];

for (const f of testFiles) {
  if (fs.existsSync(f)) {
    console.log(`[GREEN] test exists: ${f}`);
  } else {
    console.log(`[RED] test missing: ${f}`);
    missing++;
    allGreen = false;
  }
}

// Gate 3: claims.json is valid JSON and has active claims
try {
  const claims = JSON.parse(fs.readFileSync(".lane-claims/claims.json", "utf8"));
  console.log(`[GREEN] claims.json valid (${claims.claims.length} claims)`);
  if (claims.activeForHead && claims.activeForHead.length > 0) {
    console.log(`[GREEN] active claims for HEAD: ${claims.activeForHead.length}`);
  } else {
    console.log(`[WARN] no active claims for HEAD`);
  }
} catch (e) {
  console.log(`[RED] claims.json invalid: ${e.message}`);
  allGreen = false;
}

// Gate 4: capabilities.json exists and is valid
if (fs.existsSync("docs/capabilities.json")) {
  try {
    JSON.parse(fs.readFileSync("docs/capabilities.json", "utf8"));
    console.log(`[GREEN] capabilities.json valid`);
  } catch (e) {
    console.log(`[RED] capabilities.json invalid: ${e.message}`);
    allGreen = false;
  }
} else {
  console.log(`[WARN] capabilities.json not yet created`);
}

console.log(`\n=== verify:light: ${allGreen ? "ALL GREEN" : "SOME RED"} ===`);
process.exit(allGreen ? 0 : 1);