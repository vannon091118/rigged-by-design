/** Verwaiste Gate-Prozesse: PID plus Startzeit, PID-genaues Beenden, nie nach Namensmuster. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

// Tests zeigen die Registry auf ein temporaeres Verzeichnis; der Pfad wird
// deshalb erst beim Zugriff aufgeloest, nicht beim Import.
const stateDir = () => process.env.RBD_VERIFY_STATE ?? join(ROOT, 'node_modules', '.cache', 'rbd-verify');
const stateFile = () => join(stateDir(), 'running.json');
// Die Startzeit kommt unter Windows aus PowerShell. Unter paralleler Volllast
// braucht ein PowerShell-Start gut eine Sekunde, auf einem belegten Rechner
// auch mehr; ein zu knappes Limit macht die Identitaet unbekannt und damit
// einen sonst eindeutigen Waisen nicht beendbar.
const IDENTITY_TIMEOUT_MS = 15_000;

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

/**
 * Startzeit eines Prozesses. Die Kombination aus PID und Startzeit unterscheidet
 * einen laufenden Gate-Prozess von einem spaeteren Prozess mit derselben PID.
 * Linux liest /proc direkt; macOS/andere POSIX-Systeme nutzen ps, Windows PowerShell.
 */
export function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return null;
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const close = stat.lastIndexOf(')');
      // Nach dem Kommando stehen die Felder ab Zustand (3); Startzeit ist Feld 22.
      const fields = close >= 0 ? stat.slice(close + 2).trim().split(/\s+/) : [];
      const start = fields[19];
      if (start) return `linux:${start}`;
    } catch {
      // Fallback auf ps, etwa in einem Container ohne /proc.
    }
  }
  if (process.platform === 'win32') {
    try {
      const script = `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $p.StartTime.ToUniversalTime().ToString('o') }`;
      const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        timeout: IDENTITY_TIMEOUT_MS,
        windowsHide: true,
      });
      const start = (result.stdout ?? '').trim();
      return result.status === 0 && start ? `win:${start}` : null;
    } catch {
      return null;
    }
  }
  try {
    const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
      encoding: 'utf8',
      timeout: IDENTITY_TIMEOUT_MS,
    });
    const start = (result.stdout ?? '').trim();
    return result.status === 0 && start ? `ps:${start}` : null;
  } catch {
    return null;
  }
}

function sameIdentity(pid, expected) {
  if (!expected) return false;
  const current = processIdentity(pid);
  return current !== null && current === expected;
}

/** Beendet einen Prozess samt Kindern; nur die uebergebene PID, kein Muster. */
export function killTree(pid, expectedStart = null) {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  if (expectedStart && !sameIdentity(pid, expectedStart)) return false;
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

function newState() {
  return { owner: process.pid, ownerStart: processIdentity(process.pid), pids: [] };
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
    // Ohne Startzeit ist nicht sicher, ob die PID noch der alten Pipeline gehoert.
    // Dann bleibt die Registry unberuehrt, statt einen fremden Lauf zu beenden.
    const currentOwner = previous.ownerStart ? processIdentity(previous.owner) : null;
    if (!currentOwner || currentOwner === previous.ownerStart) {
      passive = true;
      log(`Pipeline ${previous.owner} laeuft noch; Registry bleibt unberuehrt`);
      return [];
    }
    log(`Besitzer-PID ${previous.owner} wurde wiederverwendet; Registry wird aufgeraeumt`);
  }
  const killed = [];
  for (const entry of previous?.pids ?? []) {
    if (!entry || !isAlive(entry.pid)) continue;
    if (!entry.start) {
      log(`verwaister ${entry.gate}-Prozess ${entry.pid} hat keine Startzeit; nicht beendet`);
      continue;
    }
    if (!killTree(entry.pid, entry.start)) {
      log(`PID ${entry.pid} gehoert nicht mehr zu ${entry.gate}; nicht beendet`);
      continue;
    }
    killed.push(entry);
    log(`verwaisten ${entry.gate}-Prozess ${entry.pid} beendet`);
  }
  state = newState();
  persist();
  return killed;
}

export function trackPid(gate, pid) {
  if (!Number.isInteger(pid) || passive) return;
  state ??= newState();
  state.pids = [...state.pids.filter((entry) => entry.pid !== pid), { gate, pid, at: Date.now(), start: processIdentity(pid) }];
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
  const entries = state.pids;
  state.pids = [];
  persist();
  let killed = 0;
  for (const entry of entries) {
    if (!isAlive(entry.pid)) continue;
    // Eine fehlende Startzeit ist im laufenden Prozess unkritisch: der Eintrag
    // stammt aus diesem Lauf. Im Orphan-Sweep wird dagegen ohne Startzeit nicht beendet.
    if (killTree(entry.pid, entry.start)) killed += 1;
  }
  return killed;
}

/** Registry nur loeschen, wenn sie uns gehoert. */
export function releaseOwner() {
  if (passive) return;
  const onDisk = readState();
  if (onDisk?.owner && onDisk.owner !== process.pid) return;
  state = null;
  rmSync(stateFile(), { force: true });
}
