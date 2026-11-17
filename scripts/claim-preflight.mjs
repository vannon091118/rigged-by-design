#!/usr/bin/env node
/**
 * Claim-Preflight vor dem Push: offene Claims, parallele Lanes und Rest-WIP.
 *
 * Der Hook ruft dieses Skript ohne Flags. `--json` liefert die vollstaendige
 * Bewertung fuer Werkzeuge. Ein fehlendes Register oder ein Branch ohne Claim
 * ist fail-closed; `main` ist durch den Branch-Schutz gedeckt.
 */
import { execFileSync } from 'node:child_process';
import { captureConsole } from './lib/compact.mjs';
import { loadClaimsStrict } from './lib/lane-claims.mjs';
import { formatClaimPreflight, inspectClaimPreflight } from './lib/claim-preflight.mjs';
import { loadTaskContracts } from './lib/task-contract.mjs';

const json = process.argv.includes('--json');
captureConsole({ label: 'claim-preflight', enabled: !json });

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let branch = process.env.BRANCH ?? '';
if (!branch) {
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    branch = '';
  }
}

if (branch === 'main') {
  const result = inspectClaimPreflight({ branch });
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatClaimPreflight(result));
  process.exit(0);
}

let claims;
try {
  claims = loadClaimsStrict();
} catch (error) {
  console.error(
    `claim-preflight: Claim-Register nicht lesbar (${error instanceof Error ? error.message : 'unbekannt'}); Push blockiert.`,
  );
  process.exit(1);
}

const loaded = loadTaskContracts();
const status = (() => {
  try {
    return git(['status', '--porcelain']);
  } catch {
    return '';
  }
})();

const result = inspectClaimPreflight({
  branch,
  claims,
  tasks: loaded.tasks,
  taskErrors: loaded.errors,
  status,
});

if (json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.blockers.length > 0 ? 1 : 0);
}

console.log(formatClaimPreflight(result));
if (result.blockers.length > 0) {
  console.error(`claim-preflight: ${result.blockers.length} Blocker; Push blockiert.`);
  process.exit(1);
}
