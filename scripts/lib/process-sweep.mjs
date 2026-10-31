/** Verwaiste Gate-Prozesse: PID-Registry, PID-genaues Beenden, nie nach Namensmuster. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

// Tests zeigen die Registry auf ein temporaeres Verzeichnis; der Pfad wird
// deshalb erst beim Zugriff aufgeloest, nicht beim Import.
const stateDir = () => process.env.RBD_VERIFY_STATE ?? join(ROOT, 'node_modules', '.cache', 'rbd-verify');
const stateFile = () => join(stateDir(), 'running.json');

let state = null;
let passive = false;

export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Beendet einen Prozess samt Kindern; nur die uebergebene PID, kein Muster. */
export function killTree(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  if (process.platform === 'win32') {
    return spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }).status === 0;
  }
  try {
    process.kill(-pid, 'SIGKILL');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
      return true;
    } catch {
      return false;
    }
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8'));
  } catch {
    return null;
  }
}

function persist() {
  if (!state || passive) return;
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify(state));
}

/** Kinder aus abgebrochenen Laeufen beenden; eine noch laufende fremde Pipeline bleibt unangetastet. */
export function sweepOrphans(log = () => {}) {
  const previous = readState();
  if (previous?.owner && previous.owner !== process.pid && isAlive(previous.owner)) {
    passive = true;
    log(`Pipeline ${previous.owner} laeuft noch; Registry bleibt unberuehrt`);
    return [];
  }
  const killed = [];
  for (const entry of previous?.pids ?? []) {
    if (!isAlive(entry.pid)) continue;
    killTree(entry.pid);
    killed.push(entry);
    log(`verwaisten ${entry.gate}-Prozess ${entry.pid} beendet`);
  }
  state = { owner: process.pid, pids: [] };
  persist();
  return killed;
}

export function trackPid(gate, pid) {
  if (!Number.isInteger(pid) || passive) return;
  state ??= { owner: process.pid, pids: [] };
  state.pids = [...state.pids.filter((entry) => entry.pid !== pid), { gate, pid, at: Date.now() }];
  persist();
}

export function untrackPid(pid) {
  if (!state || passive) return;
  state.pids = state.pids.filter((entry) => entry.pid !== pid);
  persist();
}

/** Abbruchpfad: alle registrierten Prozesse beenden, Eintraege dabei entfernen. */
export function killTracked() {
  if (!state) return 0;
  const pids = state.pids.map((entry) => entry.pid);
  state.pids = [];
  persist();
  let killed = 0;
  for (const pid of pids) if (killTree(pid)) killed += 1;
  return killed;
}

/** Registry nur loeschen, wenn sie uns gehoert. */
export function releaseOwner() {
  if (passive) return;
  state = null;
  rmSync(stateFile(), { force: true });
}
