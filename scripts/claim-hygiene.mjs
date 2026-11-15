#!/usr/bin/env node
/**
 * claim-hygiene: offene Claims gegen einen Issue-Status-Snapshot auditieren.
 *
 * Standardquelle ist der versionierte Board-Snapshot; mit `--from-file` kann
 * ein frischer `{issueStates}`-Auszug geprueft werden. Der Lauf ist lesend und
 * braucht weder `gh` noch Netz. Exit 1 nur bei einem belegten Verstoss:
 * offener Claim + Issue nachweislich geschlossen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditClaimHygiene, formatClaimHygiene, normalizeIssueStates } from './lib/claim-hygiene.mjs';
import { loadClaimsStrict } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const fromIndex = argv.indexOf('--from-file');
const file = fromIndex >= 0 ? argv[fromIndex + 1] : join(ROOT, '.lane-claims/board-state.json');
const requireKnown = argv.includes('--require-known');

if (!file) {
  console.error('claim-hygiene: --from-file braucht einen Pfad');
  process.exit(2);
}

let snapshot = {};
if (existsSync(file)) {
  try {
    snapshot = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`claim-hygiene: Snapshot nicht lesbar (${file}): ${error instanceof Error ? error.message : 'unbekannt'}`);
    process.exit(2);
  }
}

let claims;
try {
  claims = loadClaimsStrict();
} catch (error) {
  console.error(`claim-hygiene: Claim-Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  process.exit(2);
}

const result = auditClaimHygiene({ claims, issueStates: normalizeIssueStates(snapshot) });
if (json) {
  console.log(JSON.stringify({ file, ...result }, null, 2));
} else {
  console.log(formatClaimHygiene(result));
}

const unknownFailure = requireKnown && result.unknown.length > 0;
process.exit(result.violations.length > 0 || unknownFailure ? 1 : 0);
