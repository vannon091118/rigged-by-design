#!/usr/bin/env node
/**
 * verify-task-contract: prueft den Task-Vertrag des aktuellen Branches gegen
 * Claim, Phasenwechsel und Pflichtfelder. Dieselbe Validierung nutzen pretask,
 * turn:finish, ci-plan und promote; dieses CLI ist nur die aufrufbare Form.
 *
 *   node scripts/verify-task-contract.mjs                 # Arbeitsbaum
 *   node scripts/verify-task-contract.mjs --staged        # vor dem Commit
 *   node scripts/verify-task-contract.mjs --file <pfad>   # explizit
 *   node scripts/verify-task-contract.mjs --require       # fehlender Vertrag ist rot
 *
 * Ohne Vertrag bleibt eine Legacy-Lane gruen: der Vertrag wird erst mit der
 * ersten Phase-2-Aenderung Pflicht. `--require` macht ihn fuer neue Gates rot.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import {
  contractRelativePath,
  loadTaskContractForClaim,
  readTaskContractFile,
  taskIdForClaim,
  validateTaskContract,
} from './lib/task-contract.mjs';
import { fail, ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const staged = argv.includes('--staged');
const requireContract = argv.includes('--require');
const fileArg = (() => {
  const inline = argv.find((value) => value.startsWith('--file='));
  if (inline) return inline.slice('--file='.length);
  const index = argv.indexOf('--file');
  return index >= 0 ? argv[index + 1] ?? '' : '';
})();
const branch = process.env.BRANCH || gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

let claims = [];
try {
  claims = loadClaimsStrict();
} catch (error) {
  fail(1, 'ERR-4019', 'verify-task-contract', `Claim-Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  process.exit(1);
}
const claim = selectClaim(claims, branch);
if (branch === 'main' || (!claim && !fileArg)) {
  console.log(`verify-task-contract: '${branch}' hat keinen Lane-Claim; kein Task-Vertrag zu pruefen.`);
  process.exit(0);
}

let relative = fileArg;
let contract;
let error;
if (fileArg) {
  const file = join(ROOT, fileArg);
  if (!existsSync(file)) {
    fail(1, 'ERR-4019', 'verify-task-contract', `Task-Vertrag fehlt: ${fileArg}`);
    process.exit(1);
  }
  ({ contract, error } = readTaskContractFile(file));
} else {
  const loaded = loadTaskContractForClaim(claim);
  relative = loaded.file;
  contract = loaded.contract;
  error = loaded.error;
}

if (!claim && !contract) {
  console.log('verify-task-contract: kein Claim und kein Vertrag; nichts zu pruefen.');
  process.exit(0);
}

if (!contract) {
  const message = error || `kein Task-Vertrag fuer '${claim.id}' (${relative || contractRelativePath(taskIdForClaim(claim))})`;
  if (error || requireContract || staged) {
    fail(1, 'ERR-4019', 'verify-task-contract', message);
    process.exit(1);
  }
  console.log(`verify-task-contract: ${message}; Legacy-Lane bleibt ohne Vertrag gruen.`);
  process.exit(0);
}

if (claim && relative && !relative.endsWith(`/${contract.taskId}.json`) && !relative.endsWith(`${contract.taskId}.json`)) {
  fail(1, 'ERR-4019', 'verify-task-contract', `Datei ${relative} passt nicht zu taskId '${contract.taskId}'`);
  process.exit(1);
}

const previous = (() => {
  if (!relative) return null;
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${relative}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return null;
  }
})();

const validation = validateTaskContract(contract, { claim, branch, previous, enforceTransition: Boolean(previous) });
if (!validation.ok) {
  for (const violation of validation.violations) fail(1, 'ERR-4019', 'verify-task-contract', violation);
  process.exit(1);
}

const summary = {
  ok: true,
  branch,
  claim: claim ? claim.id : null,
  file: relative,
  phase: contract.phase,
  revision: contract.revision,
  findings: (contract.findings ?? []).filter((finding) => finding.status === 'open').length,
  nextAction: contract.nextAction,
};
if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`verify-task-contract: PASS (${contract.phase}, Revision ${contract.revision}, ${summary.findings} offene Befunde)`);
  console.log(`  ${relative}`);
  console.log(`  Naechster Schritt: ${contract.nextAction}`);
}
process.exit(0);
