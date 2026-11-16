/**
 * Der eine Besitzer von `.verify-cache`.
 *
 * Frueher lagen neun Artefakte nebeneinander: `task-state.json`,
 * `after-task.json`, `base-refresh.json`, `delegated.json`, `ci-cause.json`
 * und je ein `<gate>.json`. Jedes Modul kannte seinen Pfad, jedes Schema
 * hatte seine eigene Version, und niemand raeumte auf. Hier gibt es genau
 * eine Datei mit Abschnitten, eine Migration der Altdateien und einen
 * TTL-Pfad.
 *
 * Regeln:
 * - Der Zustand ist **abgeleitet und fluechtig**. Ein kaputtes oder
 *   unbekanntes State-File blockiert nie einen Lauf; es wird ersetzt.
 * - `agent-context.json`, Logs und Berichte bleiben eigene Dateien: sie sind
 *   Ausgaben, kein Zustand. Nur ihr Pfad kommt aus diesem Modul.
 * - Schreiben ist atomar (temp + rename) und wird von einer Sperrdatei
 *   umschlossen: Zwei Prozesse, die gleichzeitig verschiedene Abschnitte
 *   schreiben, verlieren keine Eintraege.
 * - Die Sperre ist Komfort, kein Blocker: Wer sie nicht bekommt, schreibt
 *   wie bisher, statt den Lauf anzuhalten.
 * - Zeit ist Infrastrukturzeit (TTL, Logs). Spielcode bleibt unberuehrt.
 */
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

export const STATE_VERSION = 1;
export const STATE_DIR = '.verify-cache';
export const STATE_FILE = `${STATE_DIR}/state.json`;
export const CONTEXT_VIEW = `${STATE_DIR}/agent-context.json`;
export const SECTIONS = Object.freeze(['task', 'base', 'delegated', 'cause', 'gates']);
/** Abschnitte, deren Alter ein TTL kennt; `base` pflegt seine eigene TTL. */
const TTL_SECTIONS = Object.freeze(['task', 'delegated', 'cause', 'gates']);
const DEFAULT_TTL_DAYS = 14;
const DEFAULT_REPORT_DAYS = 30;
const DAY_MS = 86_400_000;
/** Ausgaben und Scratch-Dateien, die kein Zustand sind und bleiben duerfen. */
const KEEP_FILES = new Set(['state.json', 'agent-context.json', 'eslint-scope.json', 'eslint.json']);
const LEGACY = Object.freeze({
  'task-state.json': 'task',
  'after-task.json': 'task.after',
  'base-refresh.json': 'base',
  'delegated.json': 'delegated',
  'ci-cause.json': 'cause',
});

export const stateDir = (root = ROOT) => join(root, STATE_DIR);
export const statePath = (root = ROOT) => join(stateDir(root), 'state.json');
export const stateLockPath = (root = ROOT) => join(stateDir(root), 'state.lock');
/** Wartezeit auf die Sperre; danach schreibt der Aufrufer ohne sie weiter. */
const LOCK_TIMEOUT_MS = 2_000;
/** Eine Sperre ohne Fortschritt gilt nach dieser Zeit als verwaist. */
const LOCK_STALE_MS = 10_000;
const LOCK_POLL_MS = 2;
let lockDepth = 0;
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

/**
 * Infrastrukturzeit fuer den TTL-Pfad: Cache-Ablauf ist ein Timeout, kein
 * Spielzustand. Deshalb steht dieses Modul in der Ausnahmeliste der
 * Determinismus-Regel (wie `gate-cache.mjs`).
 */
export const stateStamp = () => new Date().getTime();

/** Synchrones Warten ohne Busy-Loop; die Sperre wird nur Millisekunden gehalten. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Sperrverzeichnis atomar anlegen, verwaiste Sperren raeumen, sonst `null`. */
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

/**
 * Lese-Aendere-Schreibe-Zyklus serialisieren. Rekursiv aufrufbar: Ein bereits
 * gesperrter Prozess (z. B. `gcVerifyState` -> `migrateLegacy`) tritt direkt ein.
 * Ohne Sperre laeuft der Aufruf trotzdem; der Cache darf nie einen Lauf halten.
 */
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

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function emptyState() {
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
function normalize(raw) {
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
function readRaw(root = ROOT) {
  const file = statePath(root);
  if (!existsSync(file)) return emptyState();
  try {
    return normalize(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    // Kaputter Zustand ist kein Blocker: weglegen, damit er nicht verloren geht,
    // und mit einem leeren Zustand weiterarbeiten.
    try {
      renameSync(file, `${file}.corrupt`);
    } catch {
      // Auch das Weglegen ist Komfort.
    }
    return emptyState();
  }
}

function writeRaw(state, root = ROOT) {
  const file = statePath(root);
  try {
    mkdirSync(stateDir(root), { recursive: true });
    const temp = `${file}.new`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(temp, file);
    return true;
  } catch {
    // Der Cache ist Komfort; ein volles oder gesperrtes Verzeichnis haelt nichts an.
    return false;
  }
}

function touch(state, section) {
  const at = stateStamp();
  state.updatedAt = at;
  state.meta = { ...(state.meta ?? {}), [section]: at };
  return state;
}

function assign(state, target, value) {
  if (target === 'task.after') {
    state.task = { ...(isObject(state.task) ? state.task : {}), after: value };
    return;
  }
  state[target] = value;
}

function valueOf(state, target) {
  if (target === 'task.after') return isObject(state.task) ? state.task.after ?? null : null;
  return state[target] ?? null;
}

/**
 * Altdateien in die Abschnitte ueberfuehren und danach entfernen. Bereits
 * gesetzte Abschnitte gewinnen; die Altdatei ist dann nur noch Rest.
 */
export function migrateLegacy({ root = ROOT } = {}) {
  const dir = stateDir(root);
  if (!existsSync(dir)) return { migrated: [], removed: [] };
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  if (names.length === 0) return { migrated: [], removed: [] };
  // Die Altdateien und der eine neue Zustand muessen zusammen geschrieben werden.
  return withStateLock(() => migrateLegacyLocked(dir, names, root), { root });
}

function migrateLegacyLocked(dir, names, root) {
  const state = readRaw(root);
  const migrated = [];
  const removed = [];
  for (const name of names) {
    if (KEEP_FILES.has(name)) continue;
    const file = join(dir, name);
    const target = LEGACY[name] ?? (isGateRecord(file) ? 'gates' : null);
    if (!target) continue;
    try {
      const value = JSON.parse(readFileSync(file, 'utf8'));
      if (target === 'gates') {
        const gateName = name.replace(/\.json$/, '');
        if (!state.gates[gateName]) state.gates[gateName] = value;
      } else if (target === 'task') {
        // `after-task.json` kann vor `task-state.json` migriert werden; der
        // vorhandene Abschnitt gewinnt, `after` bleibt erhalten.
        state.task = { ...(isObject(value) ? value : {}), ...(isObject(state.task) ? state.task : {}) };
      } else if (valueOf(state, target) === null) {
        assign(state, target, value);
      }
      touch(state, target === 'task.after' ? 'task' : target);
      migrated.push(target === 'gates' ? `gates.${name.replace(/\.json$/, '')}` : target);
    } catch {
      // Eine unlesbare Altdatei ist wertlos; sie wird trotzdem entfernt.
    }
    try {
      rmSync(file, { force: true });
      removed.push(name);
    } catch {
      // Wenn sie bleibt, migriert der naechste Lauf sie erneut.
    }
  }
  if (migrated.length > 0) writeRaw(state, root);
  return { migrated, removed };
}

function isGateRecord(file) {
  try {
    const record = JSON.parse(readFileSync(file, 'utf8'));
    return isObject(record) && typeof record.key === 'string' && !('tests' in record);
  } catch {
    return false;
  }
}

/** Zustand lesen; Altdateien werden dabei einmalig migriert. */
export function readState({ root = ROOT } = {}) {
  migrateLegacy({ root });
  return readRaw(root);
}

export function readSection(section, { root = ROOT } = {}) {
  const state = readState({ root });
  const value = state[section];
  if (section === 'task') return isObject(value) ? value : {};
  if (section === 'gates') return isObject(value) ? value : {};
  return value ?? null;
}

/** Abschnitt vollstaendig ersetzen. */
export function setSection(section, value, { root = ROOT } = {}) {
  return withStateLock(() => {
    const state = touch(readRaw(root), section);
    state[section] = value ?? null;
    writeRaw(state, root);
    return state[section];
  }, { root });
}

/** Abschnitt zusammenfuehren; `null` loescht ihn. */
export function updateSection(section, patch, { root = ROOT } = {}) {
  return withStateLock(() => {
    const state = readRaw(root);
    const previous = isObject(state[section]) ? state[section] : {};
    const next = patch === null ? null : { ...previous, ...(isObject(patch) ? patch : {}) };
    touch(state, section);
    state[section] = next;
    writeRaw(state, root);
    return next;
  }, { root });
}

export function clearSection(section, { root = ROOT } = {}) {
  return withStateLock(() => {
    const state = touch(readRaw(root), section);
    state[section] = section === 'task' || section === 'gates' ? {} : null;
    writeRaw(state, root);
    return state[section];
  }, { root });
}

/** Gate-Cache: ein Eintrag je Gate, Schluessel bleibt Baumhash + Gate-Env. */
export function readGates({ root = ROOT } = {}) {
  const gates = readSection('gates', { root });
  return isObject(gates) ? gates : {};
}

export function writeGate(name, record, { root = ROOT } = {}) {
  return withStateLock(() => {
    const state = readRaw(root);
    state.gates = { ...(isObject(state.gates) ? state.gates : {}), [name]: record };
    touch(state, 'gates');
    writeRaw(state, root);
    return record;
  }, { root });
}

export function dropGate(name, { root = ROOT } = {}) {
  return withStateLock(() => {
    const state = readRaw(root);
    if (!isObject(state.gates) || !(name in state.gates)) return false;
    const gates = { ...state.gates };
    delete gates[name];
    state.gates = gates;
    touch(state, 'gates');
    writeRaw(state, root);
    return true;
  }, { root });
}

/**
 * Die gerenderte Agentensicht. Sie ist Ausgabe, kein Zustand: eigener Pfad,
 * damit `state.json` klein bleibt und `agent:context` sie jederzeit ersetzen darf.
 */
export function writeContextView(value, { root = ROOT } = {}) {
  const file = contextViewPath(root);
  try {
    mkdirSync(stateDir(root), { recursive: true });
    const text = `${JSON.stringify(value, null, 2)}\n`;
    const temp = `${file}.new`;
    writeFileSync(temp, text, 'utf8');
    renameSync(temp, file);
    return { file: `${CONTEXT_VIEW}`, bytes: Buffer.byteLength(text) };
  } catch {
    return { file: null, bytes: 0 };
  }
}

function ageDays(at, now) {
  // Gate-Eintraege vor #1039 trugen einen ISO-Zeitstempel; der ist nicht
  // "unendlich alt", sondern ein lesbares Datum.
  const ms = typeof at === 'string' ? Date.parse(at) : at;
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return (now - ms) / DAY_MS;
}

function removeOldEntries(dir, days, now) {
  const removed = [];
  if (!existsSync(dir)) return removed;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    try {
      if ((now - statSync(file).mtimeMs) / DAY_MS > days) {
        rmSync(file, { recursive: true, force: true });
        removed.push(`${dir.split(/[\\/]/).pop()}/${name}`);
      }
    } catch {
      // Ein nicht lesbarer Eintrag ist kein Grund anzuhalten.
    }
  }
  return removed;
}

/**
 * Der eine Aufraeumpfad: TTL je Abschnitt, alte Gate-Eintraege, alte Logs und
 * Berichte, liegengebliebene Altdateien. Laeuft im Pretask, nie im Gate.
 */
export function gcVerifyState(options = {}) {
  const root = options.root ?? ROOT;
  return withStateLock(() => gcVerifyStateLocked(options), { root });
}

function gcVerifyStateLocked({
  root = ROOT,
  now = stateStamp(),
  ttlDays = Number(process.env.RBD_VERIFY_STATE_TTL_DAYS || DEFAULT_TTL_DAYS),
  reportDays = Number(process.env.RBD_VERIFY_REPORT_TTL_DAYS || DEFAULT_REPORT_DAYS),
} = {}) {
  const ttl = Number.isFinite(ttlDays) && ttlDays >= 0 ? ttlDays : DEFAULT_TTL_DAYS;
  // Erst migrieren, dann aufraeumen: Die Altdateien gehoeren in denselben
  // Zustand, der gleich geschrieben wird. Wuerde der vor der Migration
  // gelesene Stand am Ende zurueckgeschrieben, waeren sie wieder verloren.
  const legacy = migrateLegacy({ root });
  const state = readRaw(root);
  const removed = [...legacy.removed];
  for (const section of TTL_SECTIONS) {
    if (ageDays(state.meta?.[section], now) <= ttl) continue;
    const previous = state[section];
    const empty = section === 'task' || section === 'gates' ? {} : null;
    if (JSON.stringify(previous) === JSON.stringify(empty)) continue;
    state[section] = empty;
    delete state.meta[section];
    removed.push(section);
  }
  if (isObject(state.gates)) {
    for (const [name, record] of Object.entries(state.gates)) {
      if (ageDays(record?.at, now) <= ttl) continue;
      delete state.gates[name];
      removed.push(`gates.${name}`);
    }
  }
  removed.push(...removeOldEntries(logsDir(root), ttl, now));
  removed.push(...removeOldEntries(reportsDir({ root }), reportDays, now));
  if (removed.length > 0) {
    touch(state, 'gc');
    delete state.meta.gc;
    writeRaw(state, root);
  }
  return { removed, state };
}
