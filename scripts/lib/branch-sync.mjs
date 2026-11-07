/** Merge the current main into a remote lane in an isolated temporary worktree. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IDENTITY } from './identity.mjs';
import { ROOT } from './report.mjs';

function git(args, cwd = ROOT) {
  try {
    return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() };
  } catch (error) {
    const detail = [error?.stderr, error?.stdout, error?.message].filter(Boolean).map(String).join('\n');
    return { ok: false, out: detail.slice(-1200) };
  }
}

function runNode(args, cwd) {
  try {
    return { ok: true, out: execFileSync(process.execPath, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, RBD_INVENTORY_ROOT: cwd },
    }).trim() };
  } catch (error) {
    const detail = [error?.stderr, error?.stdout, error?.message].filter(Boolean).map(String).join('\n');
    return { ok: false, out: detail.slice(-1200) };
  }
}

const SYSTEM_LINE = /^(?:<!--\s*rbd-doc:.*-->|"version":\s*".*",?)$/;

function resolveGeneratedClaimsConflict(worktree) {
  const ours = git(['show', ':2:.lane-claims/claims.json'], worktree);
  const theirs = git(['show', ':3:.lane-claims/claims.json'], worktree);
  if (!ours.ok || !theirs.ok) return false;
  try {
    const laneRows = JSON.parse(ours.out);
    const mainRows = JSON.parse(theirs.out);
    if (!Array.isArray(laneRows) || !Array.isArray(mainRows)) return false;
    const byId = new Map(laneRows.map((entry) => [entry.id, entry]));
    for (const entry of mainRows) byId.set(entry.id, entry);
    writeFileSync(join(worktree, '.lane-claims', 'claims.json'), `${JSON.stringify([...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), null, 2)}\n`);
    return git(['add', '--', '.lane-claims/claims.json'], worktree).ok;
  } catch {
    return false;
  }
}

function resolveMechanicalTextConflicts(worktree, file) {
  let text;
  try {
    text = readFileSync(join(worktree, file), 'utf8');
  } catch {
    return false;
  }
  let found = 0;
  let unresolved = false;
  const merged = text.replace(/^<{7}[^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7}[^\n]*(?:\n|$)/gm, (_block, ours, theirs) => {
    found += 1;
    const lines = [...ours.split(/\r?\n/), ...theirs.split(/\r?\n/)].map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => SYSTEM_LINE.test(line))) return theirs;
    unresolved = true;
    return _block;
  });
  if (found === 0 || unresolved) return false;
  writeFileSync(join(worktree, file), merged);
  return git(['add', '--', file], worktree).ok;
}

function resolveMergeConflicts(worktree) {
  const listed = git(['diff', '--name-only', '--diff-filter=U'], worktree);
  if (!listed.ok || !listed.out) return [];
  const files = listed.out.split(/\r?\n/).filter(Boolean);
  const resolved = [];
  for (const file of files) {
    let ok = false;
    if (file === '.lane-claims/claims.json') ok = resolveGeneratedClaimsConflict(worktree);
    else if (file === 'docs/INVENTORY.md') {
      const generated = runNode([resolve(ROOT, 'scripts/build-inventory.mjs')], worktree);
      if (generated.ok) ok = git(['add', '--', file], worktree).ok;
    }
    if (!ok) ok = resolveMechanicalTextConflicts(worktree, file);
    if (ok) resolved.push(file);
  }
  return resolved;
}

export function syncRemoteBranch(branch, mainRef = 'origin/main') {
  const fetchedMain = git(['fetch', 'origin', `+refs/heads/main:refs/remotes/origin/main`]);
  if (!fetchedMain.ok) return { status: 'failed', detail: 'main konnte nicht aktualisiert werden' };
  const fetchedBranch = git(['fetch', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  if (!fetchedBranch.ok) return { status: 'missing', detail: 'Remote-Branch fehlt oder ist nicht lesbar' };

  const mainSha = git(['rev-parse', mainRef]);
  const branchSha = git(['rev-parse', `origin/${branch}`]);
  if (!mainSha.ok || !branchSha.ok) return { status: 'failed', detail: 'Main- oder Branch-SHA fehlt' };
  const alreadyCurrent = git(['merge-base', '--is-ancestor', mainRef, `origin/${branch}`]);
  if (alreadyCurrent.ok) return { status: 'current', mainSha: mainSha.out, branchSha: branchSha.out };

  const worktree = mkdtempSync(join(tmpdir(), 'rbd-lane-sync-'));
  const safeRoot = resolve(tmpdir());
  const safeTarget = resolve(worktree);
  if (!safeTarget.startsWith(`${safeRoot}/`) && !safeTarget.startsWith(`${safeRoot}\\`)) {
    return { status: 'failed', detail: 'Temporary worktree liegt ausserhalb des Temp-Verzeichnisses' };
  }

  let added = false;
  try {
    const add = git(['worktree', 'add', '--detach', worktree, `origin/${branch}`]);
    if (!add.ok) return { status: 'failed', detail: 'Isolierter Worktree konnte nicht angelegt werden' };
    added = true;
    git(['config', 'user.name', IDENTITY.name], worktree);
    git(['config', 'user.email', IDENTITY.email], worktree);
    const merge = git(['merge', '--no-edit', mainRef], worktree);
    let autoResolved = [];
    if (!merge.ok) {
      autoResolved = resolveMergeConflicts(worktree);
      const remaining = git(['diff', '--name-only', '--diff-filter=U'], worktree);
      if (!remaining.ok || remaining.out) {
        const conflicts = remaining.out.split(/\r?\n/).filter(Boolean);
        git(['merge', '--abort'], worktree);
        return { status: 'conflict', mainSha: mainSha.out, branchSha: branchSha.out, conflicts, autoResolved };
      }
      const inProgress = git(['rev-parse', '--verify', 'MERGE_HEAD'], worktree);
      const completed = inProgress.ok ? git(['commit', '--no-edit'], worktree) : { ok: false };
      if (!completed.ok) {
        git(['merge', '--abort'], worktree);
        return { status: 'conflict', mainSha: mainSha.out, branchSha: branchSha.out, conflicts: [], autoResolved };
      }
    }
    const pushed = git(['push', 'origin', `HEAD:refs/heads/${branch}`], worktree);
    if (!pushed.ok) return { status: 'push-rejected', mainSha: mainSha.out, branchSha: branchSha.out };
    const mergedSha = git(['rev-parse', 'HEAD'], worktree);
    return { status: 'synced', mainSha: mainSha.out, branchSha: mergedSha.out, autoResolved };
  } finally {
    if (added) git(['worktree', 'remove', '--force', worktree]);
    // The path is a unique mkdtemp child under os.tmpdir and is removed only
    // after Git has detached its worktree metadata.
    rmSync(safeTarget, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}
