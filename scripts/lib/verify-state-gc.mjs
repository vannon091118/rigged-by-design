/**
 * Der eine Aufraeumpfad: TTL je Abschnitt, alte Gate-Eintraege, Logs und
 * Berichte, liegengebliebene Altdateien. Laeuft im Pretask, nie im Gate.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';
import {
  isObject, logsDir, readRaw, reportsDir, stateStamp, touch, withStateLock, writeRaw,
} from './verify-state-core.mjs';
import { migrateLegacy } from './verify-state-migrate.mjs';

const TTL_SECTIONS = Object.freeze(['task', 'delegated', 'cause', 'gates']);
const DEFAULT_TTL_DAYS = 14;
const DEFAULT_REPORT_DAYS = 30;
const DAY_MS = 86_400_000;

function ageDays(at, now) {
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
