/**
 * Register-Pflege: doctor und prune. Retention ist eine eigene Entscheidung;
 * ohne `--apply` wird nur berichtet.
 */
import { execFileSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { planRetention } from './claim-lifecycle.mjs';
import { loadTaskContracts } from './task-contract.mjs';
import { auditTaskClaimParity, validateNewClaim } from './lane-claims.mjs';

function taskEntries(cwd) {
  const loaded = loadTaskContracts({ root: cwd });
  return { entries: loaded.tasks, tasks: loaded.tasks.map((entry) => entry.contract), violations: loaded.errors };
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Letzter Commit der Datei; ohne Historie 0, dann entscheidet der Name. */
function commitTime(cwd, file) {
  try {
    return Number(
      execFileSync('git', ['log', '-1', '--format=%ct', '--', file], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(),
    ) || 0;
  } catch {
    return 0;
  }
}

// Der Pfad kommt aus dem Register, nicht aus der ID: aeltere Lane-Dateien
// tragen einen anderen Namen als ihr Slug. `claimEntryPath` wuerde eine Datei
// erfinden, die es nicht gibt, und `prune` koennte sie nie entfernen.
function claimEntryList(all, files, cwd) {
  return all.map((claim) => ({
    file: files.has(claim.id) ? relative(cwd, files.get(claim.id)).split(sep).join('/') : null,
    claim: claim.toJSON(),
    committedAt: files.has(claim.id) ? commitTime(cwd, files.get(claim.id)) : 0,
  }));
}

function retentionFor({ all, files, taskList, cwd, keep = undefined }) {
  const branch = currentBranch(cwd);
  const protectedClaimIds = all.filter((claim) => claim.branch === branch).map((claim) => claim.id);
  const protectedTaskFiles = taskList
    .filter((entry) => entry.contract.branch === branch || protectedClaimIds.includes(entry.contract.claimId))
    .map((entry) => entry.file);
  return planRetention({
    // Dieselbe Sortierbasis wie `reconcile-claims`; sonst raeumen beide
    // Werkzeuge unterschiedliche Dateien weg.
    tasks: taskList.map((entry) => ({ ...entry, committedAt: commitTime(cwd, entry.file) })),
    claims: claimEntryList(all, files, cwd),
    keep,
    protectedClaimIds,
    protectedTaskFiles,
  });
}

export function doctor({ io }) {
  const all = io.loadForCommand();
  const files = io.entryFiles();
  const violations = [];
  const seenBranches = new Map();
  for (const claim of all) {
    const legacy = !files.has(claim.id);
    const result = validateNewClaim(claim.toJSON(), { legacy });
    violations.push(...result.violations);
    if (seenBranches.has(claim.branch)) violations.push(`${claim.id}: Branch '${claim.branch}' doppelt`);
    else seenBranches.set(claim.branch, claim.id);
  }
  const contracts = taskEntries(io.cwd);
  violations.push(...contracts.violations);
  const parity = auditTaskClaimParity({
    claims: all.map((claim) => claim.toJSON()),
    tasks: contracts.tasks,
  });
  violations.push(...parity.violations);
  const retention = retentionFor({ all, files, taskList: contracts.entries, cwd: io.cwd });
  if (retention.removeTasks.length > 0 || retention.removeClaims.length > 0) {
    const count = retention.removeTasks.length + retention.removeClaims.length;
    violations.push(`Retention: ${count} alte Datei(en) ueber dem Budget von ${retention.keep} abgeschlossenen Nachweisen; 'claim:register prune --apply' ausfuehren`);
  }
  if (io.options.json) {
    console.log(JSON.stringify({ ok: violations.length === 0, claims: all.length, retention, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log(`claim:register: doctor OK (${all.length} Claims)`);
  } else {
    console.error(`claim:register: doctor fand ${violations.length} Befund(e):`);
    for (const violation of violations) console.error(`  - ${violation}`);
  }
  if (violations.length > 0) process.exit(1);
}

export function prune({ io, fail }) {
  const all = io.loadForCommand();
  const files = io.entryFiles();
  const contracts = taskEntries(io.cwd);
  if (contracts.violations.length > 0) fail(contracts.violations.join('; '));
  const retention = retentionFor({
    all, files, taskList: contracts.entries, cwd: io.cwd,
    keep: io.options.keep ? Number(io.options.keep) : undefined,
  });
  const remove = [...retention.removeTasks, ...retention.removeClaims];
  if (io.options.json) {
    console.log(JSON.stringify({ ok: true, applied: Boolean(io.options.apply), retention }, null, 2));
  } else {
    for (const file of remove) console.log(`${io.options.apply ? 'entfernt' : 'wuerde entfernen'}: ${file}`);
    if (remove.length === 0) console.log(`claim:register: retention OK (${retention.activeTasks} aktiv, ${retention.closedTasks}/${retention.keep} abgeschlossene Nachweise)`);
  }
  if (!io.options.apply) return;
  for (const file of remove) {
    try {
      unlinkSync(join(io.cwd, file));
    } catch {
      // Eine bereits entfernte Datei ist kein zweiter Fehler.
    }
  }
  if (!io.options.json) console.log(`claim:register: ${remove.length} Datei(en) entfernt`);
}
