/**
 * Eine Basis, ein Stand: `origin/main` wird vor jeder Diff- und Basis-Abfrage
 * aktualisiert. Ohne diesen Schritt rechnet `pretask` gegen einen beliebig
 * alten Remote-Ref und meldet Aenderungen, die laengst auf `main` liegen.
 *
 * Regeln:
 * - nur lesend: `git fetch` bewegt den Remote-Ref, nie Arbeitsbaum oder HEAD
 * - nie blockierend: offline, ohne Remote oder ohne Rechte bleibt der
 *   vorhandene Ref stehen; der Aufrufer bekommt `reason` und warnt
 * - ein Fetch pro TTL: mehrere Prozesse eines Turns teilen sich das Ergebnis
 * - in CI entfaellt der Fetch, der Checkout steht bereits auf dem Pruef-Ref
 *
 * Rueckgabe ist immer dieselbe Form, damit Aufrufer nicht raten muessen:
 * `{ ref, sha, previous, fetched, moved, failed, reason }`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { uptime } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

const DEFAULT_TTL_MS = 60_000;
// Ein Fehlversuch wird nicht im Sekundentakt wiederholt: sonst haengt jeder
// Befehl eines Turns erneut im Netz-Timeout.
const FAILURE_TTL_MS = 300_000;
const FETCH_TIMEOUT_MS = 12_000;
// Version 2 speichert Uptime statt Epoch-Zeit; alte Cache-Dateien verfallen.
const CACHE_VERSION = 2;
const REMOTE_REF = /^([^/]+)\/(.+)$/;

function git(cwd, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...options,
  });
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  return { status: result.status, stdout, stderr };
}

function shaOf(cwd, ref) {
  const result = git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  return result.status === 0 ? result.stdout.trim() : '';
}

function statePath(cwd) {
  return join(cwd, '.verify-cache', 'base-refresh.json');
}

function readState(cwd) {
  try {
    const record = JSON.parse(readFileSync(statePath(cwd), 'utf8'));
    return record && typeof record === 'object' ? record : null;
  } catch {
    return null;
  }
}

function writeState(cwd, record) {
  try {
    mkdirSync(join(cwd, '.verify-cache'), { recursive: true });
    writeFileSync(statePath(cwd), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  } catch {
    // Der Cache ist Komfort; der Ref allein entscheidet.
  }
}

/**
 * Aktualisiert `ref` (Default `origin/main`) und liefert den gueltigen Stand.
 * Der Aufruf ist idempotent und veraendert nie den Arbeitsbaum.
 */
export function refreshBase({
  ref = 'origin/main',
  cwd = ROOT,
  ttlMs = Number(process.env.RBD_BASE_TTL_MS || DEFAULT_TTL_MS),
} = {}) {
  const previous = shaOf(cwd, ref);
  const skip = (reason, failed = false) => ({
    ref,
    sha: previous,
    previous,
    fetched: false,
    moved: false,
    failed,
    reason,
  });

  if (!existsSync(join(cwd, '.git'))) return skip('kein Git-Checkout');
  if (process.env.RBD_NO_FETCH === '1') return skip('RBD_NO_FETCH');
  // Der CI-Checkout steht bereits exakt auf dem Pruef-Ref; ein zusaetzlicher
  // Fetch je Gate-Job waere nur Netzlast. `RBD_FETCH=1` erzwingt ihn.
  if (process.env.CI && process.env.RBD_FETCH !== '1') return skip('CI-Checkout ist bereits aktuell');

  const match = REMOTE_REF.exec(ref);
  if (!match) return skip(`kein Remote-Ref: ${ref}`);
  const [, remote, branch] = match;
  const remoteUrl = git(cwd, ['remote', 'get-url', remote]);
  if (remoteUrl.status !== 0 || !remoteUrl.stdout.trim()) return skip(`Remote '${remote}' fehlt`);

  const state = readState(cwd);
  // Cache-TTL ist Infrastrukturzeit, kein Spielzustand oder Seed. Uptime
  // statt Date/performance: der Wert ist pro Boot stabil, und ein Neustart
  // invalidiert den Cache, weil `at` dann in der Zukunft liegt.
  const now = Math.round(uptime() * 1000);
  if (
    state?.version === CACHE_VERSION
    && state?.ref === ref
    && Number.isFinite(state.at)
    && now >= state.at
    && now - state.at < ttlMs
  ) {
    return { ref, sha: state.sha, previous, fetched: false, moved: state.sha !== previous, failed: false, reason: 'TTL' };
  }
  if (
    state?.version === CACHE_VERSION
    && state?.ref === ref
    && Number.isFinite(state.failedAt)
    && now >= state.failedAt
    && now - state.failedAt < FAILURE_TTL_MS
  ) {
    return skip(`zuletzt fehlgeschlagen: ${state.reason ?? 'unbekannt'}`);
  }

  const fetched = git(
    cwd,
    ['fetch', '--quiet', '--no-tags', '--no-recurse-submodules', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`],
    { timeout: FETCH_TIMEOUT_MS },
  );
  if (fetched.status !== 0) {
    const reason = fetched.stderr.trim().split(/\r?\n/).pop() || `git fetch exit ${fetched.status ?? 'unbekannt'}`;
    writeState(cwd, { version: CACHE_VERSION, ref, sha: previous, at: 0, failedAt: now, reason });
    return skip(reason, true);
  }

  const sha = shaOf(cwd, ref) || previous;
  writeState(cwd, { version: CACHE_VERSION, ref, sha, at: now });
  return {
    ref,
    sha,
    previous,
    fetched: true,
    moved: Boolean(previous) && previous !== sha,
    failed: false,
    reason: 'ok',
  };
}
