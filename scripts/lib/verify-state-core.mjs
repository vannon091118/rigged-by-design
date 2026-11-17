/**
 * Der eine Besitzer von `.verify-cache`: Pfade, Sperre, Rohzustand.
 *
 * Der Zustand ist abgeleitet und fluechtig. Ein kaputtes State-File blockiert
 * nie einen Lauf; Schreiben ist atomar und von einer Sperrdatei umschlossen.
 */
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

export const STATE_VERSION = 1;
export const STATE_DIR = '.verify-cache';
export const STATE_FILE = `${STATE_DIR}/state.json`;
export const CONTEXT_VIEW = `${STATE_DIR}/agent-context.json`;
export const SECTIONS = Object.freeze(['task', 'base', 'delegated', 'cause', 'gates']);

export const stateDir = (root = ROOT) => join(root, STATE_DIR);
export const statePath = (root = ROOT) => join(stateDir(root), 'state.json');
export const stateLockPath = (root = ROOT) => join(stateDir(root), 'state.lock');
export const contextViewPath = (root = ROOT) => join(stateDir(root), 'agent-context.json');
export const logsDir = (root = ROOT) => join(stateDir(root), 'output');

export const reportsDir = ({ root = ROOT, stamp = null } = {}) => {
  if (process.env.RBD_VERIFY_REPORTS) {
    return stamp ? join(process.env.RBD_VERIFY_REPORTS, stamp) : process.env.RBD_VERIFY_REPORTS;
  }
  return stamp ? join(stateDir(root), 'reports', stamp) : join(stateDir(root), 'reports');
};

/** Vollstaendiges Log einer Werkzeugausgabe; PID verhindert Kollisionen. */
export const logFilePath = (label, { root = ROOT, stamp = null } = {}) => {
  const name = stamp ?? `${process.pid}-${process.hrtime.bigint().toString(36)}`;
  return join(logsDir(root), `${name}-${String(label).replace(/[^a-zA-Z0-9._-]/g, '-')}.log`);
};

/** Infrastrukturzeit fuer den TTL-Pfad: Cache-Ablauf ist ein Timeout. */
export const stateStamp = () => new Date().getTime();

const LOCK_TIMEOUT_MS = 2_000;
const LOCK_STALE_MS = 10_000;
const LOCK_POLL_MS = 2;
let lockDepth = 0;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(root) {
  const lock = stateLockPath(root);
  try {
    mkdirSync(stateDir(root), { recursive: true });
  } catch {
    return null;
  }
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      return lock;
    } catch (error) {
      if (error?.code !== 'EEXIST') return null;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Die Sperre ist gerade verschwunden; gleich nochmal versuchen.
      }
      if (Date.now() >= deadline) return null;
      sleepSync(LOCK_POLL_MS);
    }
  }
}

/** Ohne Sperre laeuft der Aufruf trotzdem; der Cache darf nie einen Lauf halten. */
export function withStateLock(fn, { root = ROOT } = {}) {
  if (lockDepth > 0) return fn();
  const lock = acquireLock(root);
  if (!lock) return fn();
  lockDepth += 1;
  try {
    return fn();
  } finally {
    lockDepth -= 1;
    try {
      rmSync(lock, { recursive: true, force: true });
    } catch {
      // Bleibt sie liegen, raeumt der naechste Schreiber sie nach der Frist.
    }
  }
}

export const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function emptyState() {
  return {
    version: STATE_VERSION,
    updatedAt: null,
    meta: {},
    task: {},
    base: null,
    delegated: null,
    cause: null,
    gates: {},
  };
}

/** Immer dieselbe Form, egal was auf der Platte liegt. */
export function normalize(raw) {
  if (!isObject(raw) || raw.version !== STATE_VERSION) return emptyState();
  const state = emptyState();
  state.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  state.meta = isObject(raw.meta) ? { ...raw.meta } : {};
  state.task = isObject(raw.task) ? { ...raw.task } : {};
  state.base = isObject(raw.base) ? raw.base : null;
  state.delegated = isObject(raw.delegated) ? raw.delegated : null;
  state.cause = isObject(raw.cause) ? raw.cause : null;
  state.gates = isObject(raw.gates) ? { ...raw.gates } : {};
  return state;
}

/** Rohes Lesen ohne Migration; jeder Fehler ergibt den leeren Zustand. */
export function readRaw(root = ROOT) {
  const file = statePath(root);
  if (!existsSync(file)) return emptyState();
  try {
    return normalize(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    try {
      renameSync(file, `${file}.corrupt`);
    } catch {
      // Auch das Weglegen ist Komfort.
    }
    return emptyState();
  }
}

export function writeRaw(state, root = ROOT) {
  const file = statePath(root);
  try {
    mkdirSync(stateDir(root), { recursive: true });
    const temp = `${file}.new`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(temp, file);
    return true;
  } catch {
    return false;
  }
}

export function touch(state, section) {
  const at = stateStamp();
  state.updatedAt = at;
  state.meta = { ...(state.meta ?? {}), [section]: at };
  return state;
}

export function assign(state, target, value) {
  if (target === 'task.after') {
    state.task = { ...(isObject(state.task) ? state.task : {}), after: value };
    return;
  }
  state[target] = value;
}

export function valueOf(state, target) {
  if (target === 'task.after') return isObject(state.task) ? state.task.after ?? null : null;
  return state[target] ?? null;
}
