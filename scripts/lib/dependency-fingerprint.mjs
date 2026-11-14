/**
 * Dependency-Fingerprint: Installation nur, wenn sich wirklich etwas aendert.
 *
 * Der Fingerprint deckt Manifeste, Lockfile, Workspace-Konfiguration, `.npmrc`,
 * Node-/pnpm-Version und Zielplattform ab. Er liegt im Workspace-Home, nicht im
 * loeschbaren Worktree. Ein neuer Worker-Worktree braucht ein neues
 * `node_modules`, aber denselben Store — deshalb ist `storeDir` Teil des
 * Fingerprints: derselbe Inhalt, anderer Store heisst neu installieren.
 */
import { createHash } from 'node:crypto';

export const INSTALL_MODES = Object.freeze(['frozen', 'offline']);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Kanonischer Hash ueber alle installrelevanten Eingaben. */
export function dependencyFingerprint({
  manifests = {},
  lockfile = '',
  workspaceConfig = '',
  npmrc = '',
  node = '',
  pnpm = '',
  platform = process.platform,
  arch = process.arch,
  mode = 'frozen',
  storeDir = '',
} = {}) {
  if (!INSTALL_MODES.includes(mode)) throw new Error(`DEPS: unbekannter Modus: ${mode}`);
  const payload = stable({ manifests, lockfile, workspaceConfig, npmrc, node, pnpm, platform, arch, mode, storeDir });
  return createHash('sha256').update(payload).digest('hex');
}

export function createDependencyRecord({
  fingerprint,
  node,
  pnpm,
  platform = process.platform,
  arch = process.arch,
  mode = 'frozen',
  storeDir = '',
  installedAt = '',
  ok = true,
} = {}) {
  return Object.freeze({
    schemaVersion: 1,
    fingerprint,
    node,
    pnpm,
    platform,
    arch,
    mode,
    storeDir,
    installedAt,
    ok: ok === true,
  });
}

/**
 * Entscheidet, ob installiert werden muss. Ein ungueltiger oder unvollstaendiger
 * Datensatz, eine fehlende Installation und jede Abweichung im Fingerprint
 * erzwingen `pnpm install --frozen-lockfile`.
 */
export function planInstall({ previous = null, fingerprint = '', installedOk = true } = {}) {
  if (!previous || previous.ok !== true) return { install: true, reason: 'no-successful-install' };
  if (!installedOk) return { install: true, reason: 'node-modules-broken' };
  if (previous.fingerprint !== fingerprint) return { install: true, reason: 'fingerprint-changed' };
  return { install: false, reason: 'reuse' };
}

/** Kommando fuer den Neuaufbau; `--offline` nur auf ausdruecklichen Wunsch. */
export function installCommand({ storeDir, mode = 'frozen' } = {}) {
  if (!storeDir) throw new Error('DEPS: storeDir fehlt');
  const offline = mode === 'offline' ? ' --offline' : '';
  return `pnpm install --frozen-lockfile --store-dir ${storeDir}${offline}`;
}
