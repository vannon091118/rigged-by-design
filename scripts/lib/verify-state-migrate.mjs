/**
 * Migration der neun alten `.verify-cache`-Artefakte in den einen Zustand.
 * Bereits gesetzte Abschnitte gewinnen; die Altdatei ist danach nur noch Rest.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';
import {
  assign, isObject, readRaw, stateDir, touch, valueOf, withStateLock, writeRaw,
} from './verify-state-core.mjs';

const KEEP_FILES = new Set(['state.json', 'agent-context.json', 'eslint-scope.json', 'eslint.json']);
const LEGACY = Object.freeze({
  'task-state.json': 'task',
  'after-task.json': 'task.after',
  'base-refresh.json': 'base',
  'delegated.json': 'delegated',
  'ci-cause.json': 'cause',
});

function isGateRecord(file) {
  try {
    const record = JSON.parse(readFileSync(file, 'utf8'));
    return isObject(record) && typeof record.key === 'string' && !('tests' in record);
  } catch {
    return false;
  }
}

export function migrateLegacy({ root = ROOT } = {}) {
  const dir = stateDir(root);
  if (!existsSync(dir)) return { migrated: [], removed: [] };
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  if (names.length === 0) return { migrated: [], removed: [] };
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
