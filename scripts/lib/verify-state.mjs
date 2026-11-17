/**
 * Der eine Besitzer von `.verify-cache` - Fassade.
 *
 * Pfade, Sperre und Rohzustand liegen in `verify-state-core.mjs`, die
 * Altdatei-Migration in `verify-state-migrate.mjs`, der TTL-Pfad in
 * `verify-state-gc.mjs`. Diese Datei bleibt die stabile API fuer Aufrufer.
 *
 * Regeln:
 * - Der Zustand ist abgeleitet und fluechtig; ein kaputtes State-File
 *   blockiert nie einen Lauf.
 * - `agent-context.json`, Logs und Berichte bleiben eigene Ausgaben.
 * - Schreiben ist atomar und von einer Sperrdatei umschlossen.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { ROOT } from './report.mjs';
import {
  CONTEXT_VIEW, contextViewPath, isObject, readRaw, stateDir, touch,
  withStateLock, writeRaw,
} from './verify-state-core.mjs';
import { migrateLegacy } from './verify-state-migrate.mjs';

export {
  CONTEXT_VIEW, SECTIONS, STATE_FILE, STATE_VERSION, contextViewPath, logsDir,
  reportsDir, logFilePath, stateDir, stateLockPath, statePath, stateStamp,
  withStateLock,
} from './verify-state-core.mjs';
export { migrateLegacy } from './verify-state-migrate.mjs';
export { gcVerifyState } from './verify-state-gc.mjs';

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
 * damit `state.json` klein bleibt.
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
