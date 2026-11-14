#!/usr/bin/env node
/**
 * worker:init — PRETASK-Baustein fuer den Worker.
 *
 * Der Befehl kennt drei Aufgaben und schreibt nie ins Repository:
 *
 * - `status`   liest `.lanes/identity.json`, prueft sie gegen die globale
 *              Reservierung und meldet `IDLE`, `ACTIVE` oder einen Blocker.
 * - `claim`    reserviert eine freie Identitaet im Identity-Board-Issue,
 *              liest den Verlauf erneut und verifiziert die Reservierung an
 *              der Kommentar-ID; erst danach schreibt er die lokale Datei.
 * - `release`  gibt die Identitaet mit derselben Claim-ID frei.
 * - `inventory` listet alle Worktrees dieses Repos mit Git-Zustand, Stashes und
 *              nicht gepushten Commits und klassifiziert sie.
 *
 * Keine Maintainer-Rechte, keine fremde WIP, kein `--force`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import {
  dispatchRole, formatIdentityClaim, formatIdentityRelease, resolveReservations,
} from './lib/worker-identity.mjs';
import {
  createIdentityRecord, isInsideRepository, readIdentityFile, shortHash,
  validateIdentityFile, workspaceHome, workspacePaths, writeIdentityFile,
} from './lib/workspace-home.mjs';
import { inventoryReport } from './lib/repo-inventory.mjs';

const REPO = 'vannon091118/rigged-by-design';
const IDENTITY_BOARD = Number(process.env.RBD_IDENTITY_BOARD ?? 0);

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

function repoRoot() {
  return git(['rev-parse', '--show-toplevel']);
}

function systemId() {
  return `sys-${shortHash(hostname().toLowerCase())}`;
}

function workspaceId(home) {
  return `ws-${shortHash(`${hostname().toLowerCase()}|${resolve(home)}`)}`;
}

function commentId(url) {
  const match = /#issuecomment-(\d+)/.exec(String(url ?? ''));
  return match ? match[1] : '';
}

function boardComments() {
  if (!IDENTITY_BOARD) throw new Error('WORKER: RBD_IDENTITY_BOARD (Issue-Nummer) fehlt');
  const raw = gh(['issue', 'view', String(IDENTITY_BOARD), '--repo', REPO, '--json', 'comments']);
  return JSON.parse(raw).comments.map((comment) => ({
    id: String(comment.id ?? commentId(comment.url)),
    body: comment.body,
  }));
}

function requireFreeBoard() {
  const state = resolveReservations(boardComments());
  if (state.conflicts.some((entry) => entry.reason === 'exclusive-claim')) {
    throw new Error(`WORKER: Identitaetskonflikt: ${state.conflicts.map((entry) => entry.reason).join(', ')}`);
  }
  return state;
}

function status() {
  const home = workspaceHome();
  const paths = workspacePaths(home);
  const record = readIdentityFile(paths.identity);
  if (!record) {
    console.log(JSON.stringify({ role: dispatchRole(), identity: null, status: 'IDLE', home, reason: 'identity-file-missing' }, null, 2));
    return 0;
  }
  const validation = validateIdentityFile(record);
  const board = IDENTITY_BOARD ? resolveReservations(boardComments()) : null;
  const verified = board
    ? board.reserved.some((entry) => entry.name === record.identity && entry.claimId === record.claimId)
    : null;
  const blocked = !validation.ok || verified === false;
  console.log(JSON.stringify({
    role: dispatchRole(),
    identity: record.identity,
    status: record.status,
    claimId: record.claimId,
    activeIssue: record.activeIssue,
    branch: record.branch,
    home,
    validation: validation.reasons,
    globallyVerified: verified,
    blockers: blocked ? ['identity-not-verified'] : [],
  }, null, 2));
  return blocked ? 1 : 0;
}

function claim(args) {
  const home = workspaceHome();
  const root = repoRoot();
  if (isInsideRepository(home, root)) throw new Error('WORKER: RBD_WORKSPACE_HOME liegt im Repository');
  const paths = workspacePaths(home);
  const state = requireFreeBoard();
  const requested = args.identity ? args.identity : state.free[0];
  if (!requested) throw new Error('WORKER: keine freie Identitaet; keine vierte erfinden');
  if (!state.free.includes(requested)) throw new Error(`WORKER: ${requested} ist nicht frei`);
  // Kein Uhrenlesen im Skript: die Zeit kommt aus dem Aufruf (--at oder RBD_NOW).
  const at = String(args.at ?? process.env.RBD_NOW ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(at)) {
    throw new Error('WORKER: --at <YYYY-MM-DDTHH:MM:SSZ> oder RBD_NOW fehlt');
  }
  const claimId = `idc-${shortHash(`${requested}|${systemId()}|${workspaceId(home)}|${at}`)}`;
  const line = formatIdentityClaim({
    name: requested,
    system: systemId(),
    workspace: workspaceId(home),
    repo: REPO,
    session: args.session ?? `sess-${shortHash(`${workspaceId(home)}|${at}`)}`,
    claimId,
    at,
  });
  const created = gh(['issue', 'comment', String(IDENTITY_BOARD), '--repo', REPO, '--body', line]);
  const verified = resolveReservations(boardComments()).reserved
    .find((entry) => entry.name === requested && entry.claimId === claimId);
  if (!verified) throw new Error('WORKER: Reservierung nach dem Kommentar nicht nachweisbar');
  const record = createIdentityRecord({
    identity: requested,
    systemId: systemId(),
    workspaceId: workspaceId(home),
    repository: REPO,
    sessionId: args.session ?? `sess-${shortHash(`${workspaceId(home)}|${at}`)}`,
    claimId,
    commentRef: created,
    reservedAt: at,
    activeIssue: args.issue ? Number(args.issue) : null,
    branch: args.branch ?? null,
    mainSha: git(['rev-parse', 'origin/main']),
    status: args.issue ? 'ACTIVE' : 'IDLE',
  });
  writeIdentityFile(paths.identity, record, { repoRoot: root });
  console.log(JSON.stringify({ identity: record.identity, claimId, commentRef: created, activeIssue: record.activeIssue, home }, null, 2));
  return 0;
}

function release(args) {
  const paths = workspacePaths(workspaceHome());
  const record = readIdentityFile(paths.identity);
  if (!record) throw new Error('WORKER: keine lokale Identitaet');
  const line = formatIdentityRelease({
    name: record.identity,
    system: record.systemId,
    workspace: record.workspaceId,
    session: record.sessionId,
    claimId: record.claimId,
    reason: args.reason ?? 'turn-end',
  });
  gh(['issue', 'comment', String(IDENTITY_BOARD), '--repo', REPO, '--body', line]);
  if (existsSync(paths.identity)) rmSync(paths.identity);
  console.log(JSON.stringify({ identity: record.identity, released: true, claimId: record.claimId }, null, 2));
  return 0;
}

function worktreeInventory() {
  const root = repoRoot();
  const blocks = git(['worktree', 'list', '--porcelain'], root).split(/\r?\n\r?\n/);
  const entries = [];
  for (const block of blocks) {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    if (!path) continue;
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? null;
    const orphaned = /^prunable/m.test(block);
    let dirtyPaths = [];
    let stagedPaths = [];
    let untrackedPaths = [];
    let stashCount = 0;
    let unpushedCommits = 0;
    let readable = true;
    try {
      const status = execFileSync('git', ['status', '--porcelain=v2', '--branch'], { cwd: path, encoding: 'utf8' });
      for (const line of status.split(/\r?\n/)) {
        if (!line) continue;
        if (line.startsWith('1 ') || line.startsWith('u ')) {
          const kind = line.split(' ')[1] ?? '..';
          if (kind[0] !== '.') stagedPaths.push(line);
          if (kind[1] !== '.') dirtyPaths.push(line);
        } else if (line.startsWith('? ')) untrackedPaths.push(line);
      }
      stashCount = git(['stash', 'list'], path).split(/\r?\n/).filter(Boolean).length;
      try {
        unpushedCommits = Number(git(['rev-list', '--count', '@{u}..HEAD'], path)) || 0;
      } catch {
        unpushedCommits = 0;
      }
    } catch {
      readable = false;
    }
    entries.push({
      path,
      role: resolve(path) === resolve(root) ? 'main' : 'worker',
      branch,
      dirtyPaths: dirtyPaths.filter(Boolean),
      stagedPaths: stagedPaths.filter(Boolean),
      untrackedPaths: untrackedPaths.filter(Boolean),
      stashCount,
      unpushedCommits,
      orphaned,
      readable,
    });
  }
  const report = inventoryReport(entries);
  console.log(JSON.stringify(report, null, 2));
  return report.cleanupAllowed ? 0 : 1;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        index += 1;
      } else args[key] = true;
    } else args._.push(token);
  }
  return args;
}

// pnpm reicht ein literales `--` als erstes Argument durch; es ist kein Flag.
const args = parseArgs(process.argv.slice(2).filter((token) => token !== '--'));
const command = args._[0] ?? 'status';
try {
  const code = command === 'claim' ? claim(args)
    : command === 'release' ? release(args)
      : command === 'inventory' ? worktreeInventory()
        : status();
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
