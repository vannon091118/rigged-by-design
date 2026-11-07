#!/usr/bin/env node
/**
 * NAR-10/NAR-11 read-only content verification.
 *
 * Schema, vocabulary, macros, conflicts, manifest and the exact JSON/TypeScript
 * registry bytes are checked here; the existing Assets gate imports the same
 * validation.
 */
import { resolve } from 'node:path';
import { loadNarrativeContent } from './lib/narrative-content.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const report = loadNarrativeContent(ROOT);

if (!report.ok) {
  for (const problem of report.issues) console.error(`[ERR-4022] ${problem.path}: ${problem.message}`);
  process.exit(1);
}

console.log(`[narrative-content] ${report.contributionCount} Beitraege, ${report.turnCount} Turns, ${report.registryCount} Fragmente, ${report.contentHash}`);
console.log(`[narrative-content] Runtime-Registry: src/core/sim/narrative/composer/registry.generated.ts`);
