#!/usr/bin/env node
/**
 * Claim-Register: eine Datei pro Lane.
 *
 * Neue Claims werden nicht in das gemeinsame `claims.json` geschrieben.
 * Jede Lane legt ihre eigene Datei unter `.lane-claims/claims/` an; der Loader
 * fuehrt sie mit dem Legacy-Bestand zusammen. `update` schreibt den bestehenden
 * Ort weiter, `doctor` prueft beide Ablagen. Das Legacy-JSON wird beim
 * Aktualisieren eines Legacy-Claims gelockt; Claim-Dateien werden atomar
 * ersetzt und bei `add` niemals ueberschrieben.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { refreshBase } from './lib/base-refresh.mjs';
import { claimEntryPath, planRetention } from './lib/claim-lifecycle.mjs';
import { loadTaskContracts } from './lib/task-contract.mjs';
import {
  BRANCH_PATTERN,
  LEGACY_PREFIXES,
  LaneClaim,
  OWNERS,
  auditTaskClaimParity,
  loadClaimsStrict,
  validateNewClaim,
} from './lib/lane-claims.mjs';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'add';

function parseOptions(argv) {
  const options = { allow: [] };
  const booleans = new Set(['json', 'help', 'apply']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') continue;
    if (!token.startsWith('--')) {
      options._ = token;
      continue;
    }
    const [name, inline] = token.slice(2).split('=', 2);
    if (booleans.has(name)) {
      options[name] = true;
      continue;
    }
    const value = inline !== undefined ? inline : argv[++index];
    if (name === 'allow') {
      if (!value) throw new Error('--allow braucht einen Pfad');
      options.allow.push(...String(value).split(',').map((entry) => entry.trim()).filter(Boolean));
    } else {
      if (!value) throw new Error(`--${name} braucht einen Wert`);
      options[name] = value;
    }
  }
  return options;
}

function fail(message) {
  console.error(`claim:register: ${message}`);
  process.exit(1);
}

const options = parseOptions(args);
const cwd = process.cwd();
const claimsDir = join(cwd, '.lane-claims');
const entriesDir = join(claimsDir, 'claims');
const legacyFile = join(claimsDir, 'claims.json');

function readEntries(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const entries = Array.isArray(data) ? data : [data];
  if (entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new Error(`Claim-Eintrag ist kein Objekt: ${file}`);
  }
  return entries;
}

function entryFiles() {
  const files = new Map();
  if (!existsSync(entriesDir)) return files;
  for (const name of readdirNames(entriesDir)) {
    if (!name.endsWith('.json')) continue;
    const file = join(entriesDir, name);
    for (const entry of readEntries(file)) {
      if (files.has(entry.id)) throw new Error(`Doppelter Claim '${entry.id}' in ${files.get(entry.id)} und ${file}`);
      files.set(entry.id, file);
    }
  }
  return files;
}

function readdirNames(dir) {
  return readdirSync(dir);
}

function claimFileFor(id) {
  const slug = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  if (!slug) fail(`Claim-ID '${id}' ergibt keinen Dateinamen`);
  return join(entriesDir, `${slug}.json`);
}

function writeAtomic(file, value, { overwrite = true } = {}) {
  mkdirSync(entriesDir, { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (!overwrite) {
    // O_EXCL: ein vorhandener Claim wird nie ueberschrieben, auch nicht bei
    // zwei gleichzeitig startenden Agenten.
    const fd = openSync(file, 'wx');
    try {
      writeFileSync(fd, content, 'utf8');
    } finally {
      closeSync(fd);
    }
    return;
  }
  const temp = `${file}.new`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, file);
}

function withLegacyLock(fn) {
  mkdirSync(claimsDir, { recursive: true });
  const lock = `${legacyFile}.lock`;
  let fd;
  try {
    fd = openSync(lock, 'wx');
  } catch {
    fail(`Legacy-Register ist gesperrt: ${lock}`);
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try {
      unlinkSync(lock);
    } catch {
      // Ein bereits entfernter Lock ist kein zweiter Fehler.
    }
  }
}

function loadForCommand() {
  if (!existsSync(legacyFile) && !existsSync(entriesDir)) return [];
  try {
    return loadClaimsStrict();
  } catch (error) {
    fail(`Register nicht lesbar: ${error instanceof Error ? error.message : 'unbekannt'}`);
  }
}

function baseSha() {
  if (options.base) return options.base;
  // Ein Claim auf einem alten `origin/main` erzeugt spaeter Phantom-Diffs;
  // der Refresh scheitert leise und faellt auf den vorhandenen Ref zurueck.
  const refreshed = refreshBase({ cwd });
  if (refreshed.sha) return refreshed.sha;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    fail('keine Basis: weder origin/main noch HEAD aufloesbar');
    return '';
  }
}

function requireId() {
  const id = options.id ?? options._;
  if (!id) fail('--id fehlt');
  return id;
}

function validateOrFail(claim, { legacy = false } = {}) {
  const result = validateNewClaim(claim, { legacy });
  if (!result.ok) fail(result.violations.join('; '));
}

function printClaim(claim) {
  if (options.json) {
    console.log(JSON.stringify({ ok: true, claim }, null, 2));
    return;
  }
  console.log(`claim:register: ${claim.id}`);
  console.log(`  Owner: ${claim.owner}`);
  console.log(`  Branch: ${claim.branch}`);
  console.log(`  Basis: ${claim.baseSha}`);
  console.log(`  Issue: ${claim.issue ? `#${claim.issue}` : '(keine Nummer)'}`);
  console.log(`  Status: ${claim.status}`);
  console.log(`  Pfade: ${claim.pathAllowlist.length}`);
  console.log('  Naechster Schritt: pnpm run agent:pretask --json');
}

function addClaim() {
  const id = requireId();
  const owner = options.owner;
  if (!owner) fail('--owner fehlt');
  if (!OWNERS.includes(owner)) fail(`Owner '${owner}' ist nicht im Roster (${OWNERS.join(', ')})`);
  const branch = options.branch ?? id;
  if (!BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
    fail(`Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>`);
  }
  const task = options.task;
  if (!task) fail('--task fehlt: Task-Ziel ist Teil des Arbeitsvertrags');
  const issue = options.issue === undefined ? null : Number(options.issue);
  if (options.issue !== undefined && (!Number.isInteger(issue) || issue <= 0)) fail(`--issue '${options.issue}' ist keine Issue-Nummer`);
  if (options.allow.length === 0) fail('mindestens ein --allow-Pfad ist erforderlich');

  const existing = loadForCommand();
  if (existing.some((claim) => claim.id === id)) fail(`Claim '${id}' ist bereits registriert`);
  if (existing.some((claim) => claim.branch === branch)) fail(`Branch '${branch}' hat bereits einen Claim`);

  const file = claimFileFor(id);
  if (existsSync(file)) fail(`${file} existiert bereits; bestehende Claims werden nicht ueberschrieben`);
  const allowlist = [...new Set([...options.allow, `.lane-claims/claims/${file.split(/[\\/]/).pop()}`])];
  const claim = new LaneClaim({
    id,
    owner,
    branch,
    baseSha: baseSha(),
    task,
    goal: options.goal ?? '',
    issue,
    pathAllowlist: allowlist,
    gateProfile: options['gate-profile'] ?? 'light',
    status: 'open',
  });
  validateOrFail(claim.toJSON());
  writeAtomic(file, claim.toJSON(), { overwrite: false });
  printClaim(claim.toJSON());
}

function updateClaim() {
  const id = requireId();
  const existingFiles = entryFiles();
  const all = loadForCommand();
  const current = all.find((claim) => claim.id === id);
  if (!current) fail(`Claim '${id}' ist nicht registriert`);
  const next = { ...current.toJSON() };
  if (options.owner !== undefined) next.owner = options.owner;
  if (options.branch !== undefined) next.branch = options.branch;
  if (options.task !== undefined) next.task = options.task;
  if (options.goal !== undefined) next.goal = options.goal;
  if (options.issue !== undefined) next.issue = Number(options.issue);
  if (options.base !== undefined) next.baseSha = options.base;
  if (options['gate-profile'] !== undefined) next.gateProfile = options['gate-profile'];
  if (options.status !== undefined) next.status = options.status;
  if (options.allow.length > 0) next.pathAllowlist = [...new Set(options.allow)];
  if (!['open', 'merged', 'archived', 'parked', 'superseded'].includes(next.status)) fail(`Status '${next.status}' ist unbekannt`);
  const legacy = !existingFiles.has(id);
  validateOrFail(next, { legacy });

  if (!legacy) {
    writeAtomic(existingFiles.get(id), next);
  } else {
    try {
      withLegacyLock(() => {
        const entries = readEntries(legacyFile);
        const index = entries.findIndex((entry) => entry.id === id);
        if (index < 0) throw new Error(`Claim '${id}' ist nicht im Legacy-Register`);
        entries[index] = next;
        const temp = `${legacyFile}.new`;
        writeFileSync(temp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
        renameSync(temp, legacyFile);
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Legacy-Update fehlgeschlagen');
    }
  }
  printClaim(next);
}

function listClaims() {
  const all = loadForCommand();
  if (options.json) {
    console.log(JSON.stringify({ ok: true, claims: all.map((claim) => claim.toJSON()) }, null, 2));
    return;
  }
  for (const claim of all) {
    console.log(`${claim.status.padEnd(9)} ${claim.id}  ${claim.owner}  ${claim.branch}`);
  }
}

function taskEntries() {
  const loaded = loadTaskContracts({ root: cwd });
  return { entries: loaded.tasks, tasks: loaded.tasks.map((entry) => entry.contract), violations: loaded.errors };
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function claimEntryList(all, files) {
  return all.map((claim) => ({
    file: files.has(claim.id) ? claimEntryPath(claim.id) : null,
    claim: claim.toJSON(),
    committedAt: 0,
  }));
}

function retentionFor(all, files, taskList, keep = undefined) {
  const branch = currentBranch();
  const protectedClaimIds = all.filter((claim) => claim.branch === branch).map((claim) => claim.id);
  const protectedTaskFiles = taskList
    .filter((entry) => entry.contract.branch === branch || protectedClaimIds.includes(entry.contract.claimId))
    .map((entry) => entry.file);
  return planRetention({
    tasks: taskList,
    claims: claimEntryList(all, files),
    keep,
    protectedClaimIds,
    protectedTaskFiles,
  });
}

function doctor() {
  const all = loadForCommand();
  const files = entryFiles();
  const violations = [];
  const seenBranches = new Map();
  for (const claim of all) {
    const legacy = !files.has(claim.id);
    const result = validateNewClaim(claim.toJSON(), { legacy });
    violations.push(...result.violations);
    if (seenBranches.has(claim.branch)) violations.push(`${claim.id}: Branch '${claim.branch}' doppelt`);
    else seenBranches.set(claim.branch, claim.id);
  }
  const contracts = taskEntries();
  violations.push(...contracts.violations);
  const parity = auditTaskClaimParity({
    claims: all.map((claim) => claim.toJSON()),
    tasks: contracts.tasks,
  });
  violations.push(...parity.violations);
  const retention = retentionFor(all, files, contracts.entries);
  if (retention.removeTasks.length > 0 || retention.removeClaims.length > 0) {
    const count = retention.removeTasks.length + retention.removeClaims.length;
    violations.push(`Retention: ${count} alte Datei(en) ueber dem 10-Task-Limit; 'claim:register prune --apply' ausfuehren`);
  }
  if (options.json) {
    console.log(JSON.stringify({ ok: violations.length === 0, claims: all.length, retention, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log(`claim:register: doctor OK (${all.length} Claims)`);
  } else {
    console.error(`claim:register: doctor fand ${violations.length} Befund(e):`);
    for (const violation of violations) console.error(`  - ${violation}`);
  }
  if (violations.length > 0) process.exit(1);
}

function prune() {
  const all = loadForCommand();
  const files = entryFiles();
  const contracts = taskEntries();
  if (contracts.violations.length > 0) fail(contracts.violations.join('; '));
  const retention = retentionFor(all, files, contracts.entries, options.keep ? Number(options.keep) : undefined);
  const remove = [...retention.removeTasks, ...retention.removeClaims];
  if (options.json) {
    console.log(JSON.stringify({ ok: true, applied: Boolean(options.apply), retention }, null, 2));
  } else {
    for (const file of remove) console.log(`${options.apply ? 'entfernt' : 'wuerde entfernen'}: ${file}`);
    if (remove.length === 0) console.log(`claim:register: retention OK (${retention.closedTasks}/${retention.keep} abgeschlossene Tasks)`);
  }
  if (!options.apply) return;
  for (const file of remove) {
    try {
      unlinkSync(join(cwd, file));
    } catch {
      // Eine bereits entfernte Datei ist kein zweiter Fehler.
    }
  }
  if (!options.json) console.log(`claim:register: ${remove.length} Datei(en) entfernt`);
}

if (options.help) {
  console.log('claim:register [add|update|list|doctor|prune] --id <lane/id> --owner <owner> --task <text> [--goal <text>] [--issue <nr>] [--allow <pfad>]... [--keep 10] [--apply] [--json]');
  process.exit(0);
}
if (command === 'add') addClaim();
else if (command === 'update') updateClaim();
else if (command === 'list') listClaims();
else if (command === 'doctor') doctor();
else if (command === 'prune') prune();
else fail(`unbekannter Befehl '${command}'; erlaubt sind add, update, list, doctor und prune`);
