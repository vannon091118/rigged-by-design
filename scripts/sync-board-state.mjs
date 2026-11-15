#!/usr/bin/env node
/**
 * board:sync — Board-State aus GitHub und Git nachziehen (#834).
 *
 * Default schreibt `.lane-claims/board-state.json`. `--check` schreibt nichts
 * und meldet Drift mit Exit 1. Ein nicht abfragbares Board ist Exit 2: ohne
 * Beleg entsteht kein Snapshot aus Vermutungen.
 *
 * Aufruf:
 *   pnpm run board:sync -- --at 2026-11-15T04:00:00Z            # Datei nachziehen
 *   pnpm run board:sync -- --check --at 2026-11-15T04:00:00Z   # Drift pruefen
 *   RBD_NOW=2026-11-15T04:00:00Z pnpm run board:sync
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  boardDrift, formatBoardState, nextBoardState, splitBoard,
} from './lib/board-state.mjs';
import { ROOT } from './lib/report.mjs';

const REPO = 'vannon091118/rigged-by-design';
const STATE_FILE = join(ROOT, '.lane-claims/board-state.json');
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const atFlag = argv.indexOf('--at');
// Kein Uhrenlesen: die Zeit kommt aus dem Aufruf, damit derselbe Board-Stand
// denselben Snapshot ergibt.
const at = atFlag >= 0 ? argv[atFlag + 1] : process.env.RBD_NOW;

/** Ein kontrollierter `gh`-Aufruf; Fehler bleiben Fehler, kein leerer Erfolg. */
function ghJson(args) {
  const bin = process.env.RBD_GH_BIN || 'gh';
  const full = process.env.RBD_GH_SCRIPT ? [process.env.RBD_GH_SCRIPT, ...args] : args;
  try {
    const output = execFileSync(bin, full, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, data: JSON.parse(output) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.split('\n')[0] : 'unbekannt' };
  }
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function readPrevious() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (error) {
    return { __unreadable: error instanceof Error ? error.message : String(error) };
  }
}

if (!at || Number.isNaN(Date.parse(at))) {
  console.error('BOARD: --at/RBD_NOW fehlt oder ist kein ISO-Zeitstempel');
  process.exit(2);
}
const previous = readPrevious();
if (previous?.__unreadable) {
  console.error(`BOARD: ${STATE_FILE} ist unlesbar (${previous.__unreadable})`);
  process.exit(2);
}

const head = git(['rev-parse', 'origin/main']) || git(['rev-parse', 'HEAD']);
if (!head) {
  console.error('BOARD: main-Kopf nicht lesbar; kein Snapshot ohne Basis');
  process.exit(2);
}
const listing = ghJson(['api', '--paginate', `repos/${REPO}/issues?state=open&per_page=100`]);
if (!listing.ok || !Array.isArray(listing.data)) {
  console.error(`BOARD: offene Issues nicht lesbar (${listing.error ?? 'kein Array'}); kein Snapshot aus Vermutungen`);
  process.exit(2);
}
const { issues, pullRequests } = splitBoard(listing.data);

let next;
try {
  next = nextBoardState({
    previous: previous ?? {},
    issues,
    pullRequests,
    head,
    headMessage: git(['log', '-1', '--format=%s', head]) || null,
    at,
    worktree: git(['rev-parse', '--show-toplevel']) || null,
  });
} catch (error) {
  console.error(`BOARD: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

if (check) {
  const drift = boardDrift({ previous, next: next.state, dropped: next.dropped });
  console.log(JSON.stringify({
    checked: true, file: STATE_FILE, head: next.state.head, drift,
  }, null, 2));
  process.exit(drift.length === 0 ? 0 : 1);
}

writeFileSync(STATE_FILE, formatBoardState(next.state));
console.log(JSON.stringify({
  written: true,
  file: STATE_FILE,
  head: next.state.head,
  openIssues: next.state.openIssuesCount,
  openPullRequests: next.state.openPullRequests,
  reviewWaitingPrs: next.state.reviewWaitingPrs,
  droppedClaims: next.dropped.map((claim) => claim?.issue ?? null),
}, null, 2));
