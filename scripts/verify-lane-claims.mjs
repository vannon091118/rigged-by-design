#!/usr/bin/env node
/**
 * verify-lane-claims: Prüft, ob der aktuelle Branch einen Lane-Claim hat
 * und alle gestagten Dateien innerhalb der Allowlist liegen. Kollisionen
 * mit anderen offenen Lanes werden ebenfalls erkannt.
 *
 * Exit 0 = OK, Exit 1 = Claim fehlt, Verletzung oder Kollision.
 */
import { execFileSync } from 'node:child_process';
import { openClaims, findCollisions } from './lib/lane-claims.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const claims = openClaims();
const claim = claims.find((c) => c.branch === branch);

if (!claim) {
  console.error(`[ERR-4019] verify-lane-claims: Kein Lane-Claim für Branch '${branch}' in .lane-claims/claims.json`);
  console.error('  Erst einen Claim registrieren (siehe scripts/lib/lane-claims.mjs und AGENTS.md § Lane- und Konflikt-Governance).');
  process.exit(1);
}

/**
 * Generierte Meta-Dateien, die vom System/Pre-Commit-Hook geschrieben
 * werden (nicht vom Agenten hand-editiert). Sie sind vom Claim-Check
 * ausgenommen, weil jede Lane sie braucht, sobald ein Commit entsteht:
 * INVENTORY, Pflichtdoku-Marker, Version/Lockfile und Governance-Hooks.
 */
const GENERATED_META = Object.freeze([
  'docs/INVENTORY.md',
  'AGENTS.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVTAGEBUCH.md',
  'docs/ROADMAP.md',
  'package.json',
  'pnpm-lock.yaml',
  '.githooks/pre-commit',
  '.githooks/commit-msg',
]);

const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split(/\r?\n/).filter(Boolean);

// Generierte Meta-Dateien sind vom Claim-Check ausgenommen (System schreibt sie).
const featureStaged = staged.filter((f) => !GENERATED_META.includes(f));

const violations = featureStaged.filter((f) => !claim.allowsPath(f));
if (violations.length > 0) {
  console.error(`[ERR-4019] verify-lane-claims: Dateien außerhalb der Lane-Allowlist für '${branch}':`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error(`  Erlaubte Pfade: ${claim.pathAllowlist.join(', ')}`);
  console.error(`  Generierte Meta (ausgenommen): ${GENERATED_META.join(', ')}`);
  process.exit(1);
}

const collisions = findCollisions(claim);
if (collisions.length > 0) {
  console.error(`[ERR-4019] verify-lane-claims: Lane-Kollisionen für '${branch}':`);
  for (const coll of collisions) {
    console.error(`  vs ${coll.lane}: ${coll.reason}`);
    if (coll.contractConflict.length > 0) {
      console.error(`    Contract-Konflikt: ${coll.contractConflict.join(', ')}`);
    }
  }
  process.exit(1);
}

console.log(`verify-lane-claims: Branch '${branch}' ist claim-konform (${staged.length} gestagte Datei(en) innerhalb der Allowlist).`);
process.exit(0);
