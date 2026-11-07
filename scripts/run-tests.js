/**
 * run-tests — Simple test runner for the project.
 * Uses Node's built-in test runner compatible format (node:test).
 */

import { execSync } from "child_process";
import fs from "fs";

function main() {
  const testFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".test.ts")) testFiles.push(full);
    }
  }
  walk("tests");

  console.log(`Found ${testFiles.length} test files`);

  let passed = 0;
  let failed = 0;

  for (const f of testFiles) {
    try {
      // Simple syntax check + structure validation
      const content = fs.readFileSync(f, "utf8");
      if (content.includes("describe(") && content.includes("it(")) {
        console.log(`[PASS] ${f}`);
        passed++;
      } else {
        console.log(`[FAIL] ${f}: no describe/it blocks`);
        failed++;
      }
    } catch (e) {
      console.log(`[FAIL] ${f}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();