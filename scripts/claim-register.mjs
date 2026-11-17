#!/usr/bin/env node
/**
 * Claim-Register: eine Datei pro Lane.
 *
 * Neue Claims werden nicht in das gemeinsame `claims.json` geschrieben.
 * Jede Lane legt ihre eigene Datei unter `.lane-claims/claims/` an; der Loader
 * fuehrt sie mit dem Legacy-Bestand zusammen. `update` schreibt den bestehenden
 * Ort weiter, `doctor` prueft beide Ablagen.
 */
import { spawnSync } from 'node:child_process';
import { captureConsole } from './lib/compact.mjs';
import { makeRegisterIO, parseRegisterOptions } from './lib/claim-register-io.mjs';
import { addClaim, updateClaim } from './lib/claim-register-commands.mjs';
import { doctor, prune } from './lib/claim-register-maintenance.mjs';

captureConsole({ label: 'claim-register' });

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'add';

function fail(message) {
  console.error(`claim:register: ${message}`);
  process.exit(1);
}

let options;
try {
  options = parseRegisterOptions(args);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const cwd = process.cwd();
const io = makeRegisterIO({ cwd, options, fail });

function listClaims() {
  const all = io.loadForCommand();
  if (options.json) {
    console.log(JSON.stringify({ ok: true, claims: all.map((claim) => claim.toJSON()) }, null, 2));
    return;
  }
  for (const claim of all) {
    console.log(`${claim.status.padEnd(9)} ${claim.id}  ${claim.owner}  ${claim.branch}`);
  }
}

/**
 * Eine Lane freigeben, ohne den Beleg zu loeschen. `archived` ist der ehrliche
 * Zustand fuer einen Claim, dessen Arbeit nicht gemergt wurde.
 */
function releaseClaim() {
  const id = io.requireId();
  if (!options.reason) fail('--reason fehlt: eine Freigabe braucht einen Grund');
  const files = io.entryFiles();
  const current = io.loadForCommand().find((claim) => claim.id === id);
  if (!current) fail(`Claim '${id}' ist nicht registriert`);
  if (current.status !== 'open') fail(`Claim '${id}' ist '${current.status}', nicht offen`);
  const next = {
    ...current.toJSON(),
    status: 'archived',
    releasedAt: new Date().toISOString(),
    releasedReason: options.reason,
  };
  io.validateOrFail(next, { legacy: !files.has(id) });
  io.writeAtomic(files.get(id), next);
  io.printClaim(next);
}

/** Erste aufloesbare Ref eines Branches; `null`, wenn es ihn nicht mehr gibt. */
function branchSha(branch) {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd, encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  return null;
}

/** Liegt der Branch-Kopf bereits in `origin/main`? Dann ist der Claim belegt. */
function mergedIntoMain(sha) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { cwd });
  return result.status === 0;
}

/**
 * Offene Claims gegen die Wirklichkeit pruefen: Branch weg oder schon in main.
 * Ohne `--apply` nur ein Bericht.
 */
function staleClaims() {
  const files = io.entryFiles();
  const rows = [];
  for (const claim of io.loadForCommand()) {
    if (claim.status !== 'open') continue;
    const sha = branchSha(claim.branch);
    if (!sha) rows.push({ claim, next: 'archived', reason: 'stale-no-branch', sha: null });
    else if (mergedIntoMain(sha)) rows.push({ claim, next: 'merged', reason: 'branch-in-main', sha });
    else rows.push({ claim, next: 'open', reason: 'branch-active', sha });
  }
  if (options.json) {
    console.log(JSON.stringify({
      ok: true,
      applied: Boolean(options.apply),
      items: rows.map((row) => ({ id: row.claim.id, owner: row.claim.owner, branch: row.claim.branch, next: row.next, reason: row.reason, sha: row.sha })),
    }, null, 2));
  } else {
    for (const row of rows) {
      console.log(`${options.apply && row.next !== 'open' ? 'setze' : 'befund'}: ${row.claim.id} -> ${row.next} (${row.reason})`);
    }
  }
  if (!options.apply) return;
  let changed = 0;
  for (const row of rows) {
    if (row.next === 'open') continue;
    const current = row.claim.toJSON();
    const next = row.next === 'merged'
      ? { ...current, status: 'merged', mergedEvidence: 'branch-in-main', mergedSha: String(row.sha).slice(0, 8) }
      : { ...current, status: 'archived', releasedAt: new Date().toISOString(), releasedReason: row.reason };
    io.validateOrFail(next, { legacy: !files.has(row.claim.id) });
    io.writeAtomic(files.get(row.claim.id), next);
    changed += 1;
  }
  if (!options.json) console.log(`claim:register: ${changed} Claim(s) nachgezogen`);
}

if (options.help) {
  console.log('claim:register [add|update|list|doctor|prune|release|stale] --id <lane/id> --owner <owner> --task <text> [--goal <text>] [--issue <nr>] [--allow <pfad>]... [--keep 10] [--apply] [--json]');
  process.exit(0);
}

if (command === 'add') addClaim({ io, fail });
else if (command === 'update') updateClaim({ io, fail });
else if (command === 'list') listClaims();
else if (command === 'doctor') doctor({ io, fail });
else if (command === 'prune') prune({ io, fail });
else if (command === 'release') releaseClaim();
else if (command === 'stale') staleClaims();
else fail(`unbekannter Befehl '${command}'; erlaubt sind add, update, list, doctor, prune, release und stale`);
