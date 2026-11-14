/**
 * Workspace-Home: der einzige Ort, der Worktree-Neuaufbauten ueberlebt.
 *
 * Der Container liegt ausserhalb beider Git-Worktrees und traegt Identitaet,
 * Dependency-Fingerprint und den pnpm-Store. `main/` und `worker/` sind die
 * beiden regulaeren Arbeitsbaeume; beide duerfen geloescht werden, das Home
 * nicht. Hier stehen keine Secrets, Tokens oder Sitzungsschluessel.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { WORKER_IDENTITIES } from './worker-identity.mjs';

export const IDENTITY_SCHEMA = 1;
export const DEPENDENCY_SCHEMA = 1;
export const IDENTITY_STATUSES = Object.freeze(['IDLE', 'ACTIVE', 'REVIEW_PENDING', 'BLOCKED']);

/** Wurzel des Workspace-Containers; `RBD_WORKSPACE_HOME` gewinnt. */
export function workspaceHome(env = process.env) {
  const configured = String(env?.RBD_WORKSPACE_HOME ?? '').trim();
  return resolve(configured || join(homedir(), '.rbd-workspace'));
}

/** Feste Pfade im Container; keine Ableitung aus dem aktuellen Repo. */
export function workspacePaths(home = workspaceHome()) {
  const root = resolve(home);
  const lanes = join(root, '.lanes');
  return Object.freeze({
    root,
    lanes,
    identity: join(lanes, 'identity.json'),
    dependencies: join(lanes, 'dependencies.json'),
    store: join(root, '.pnpm-store'),
    main: join(root, 'main'),
    worker: join(root, 'worker'),
  });
}

/** Ein Pfad im Repo ist kein gueltiges Home: sonst stirbt die Identitaet mit dem Baum. */
export function isInsideRepository(path, repoRoot) {
  const target = relative(resolve(repoRoot), resolve(path));
  // Ueber Laufwerksgrenzen (Windows `C:` -> `D:`) liefert `relative()` einen
  // absoluten Pfad. Der beginnt nie mit `..` und gaelte sonst als Unterpfad;
  // ein absolutes Ergebnis heisst immer: ausserhalb des Repositories.
  if (isAbsolute(target)) return false;
  return target === '' || (!target.startsWith('..') && !target.includes(`..${sep}`));
}

function requireText(value, name, reasons) {
  if (typeof value !== 'string' || value.trim() === '') reasons.push(`${name}-missing`);
}

/**
 * Prueft die Identitaetsdatei. Sie ist die lokale Kopie der globalen
 * Reservierung; fehlt ein Pflichtfeld, ist die Datei ungueltig und der Worker
 * startet nicht.
 */
export function validateIdentityFile(value) {
  const reasons = [];
  if (!value || typeof value !== 'object') return { ok: false, reasons: ['file-missing'] };
  if (Number(value.schemaVersion) !== IDENTITY_SCHEMA) reasons.push('schema-version');
  requireText(value.identity, 'identity', reasons);
  requireText(value.systemId, 'system', reasons);
  requireText(value.workspaceId, 'workspace', reasons);
  requireText(value.repository, 'repository', reasons);
  requireText(value.sessionId, 'session', reasons);
  requireText(value.claimId, 'claim', reasons);
  requireText(value.commentRef, 'comment-ref', reasons);
  requireText(value.reservedAt, 'reserved-at', reasons);
  requireText(value.mainSha, 'main-sha', reasons);
  if (typeof value.identity === 'string' && !WORKER_IDENTITIES.includes(value.identity)) reasons.push('identity-unknown');
  if (!IDENTITY_STATUSES.includes(value.status)) reasons.push('status-unknown');
  if (value.activeIssue !== null && !Number.isInteger(value.activeIssue)) reasons.push('active-issue-invalid');
  if (value.branch !== null && typeof value.branch !== 'string') reasons.push('branch-invalid');
  return { ok: reasons.length === 0, reasons };
}

/** Baut den Datensatz; die Reservierung selbst kommt aus `worker-identity`. */
export function createIdentityRecord({
  identity,
  systemId,
  workspaceId,
  repository,
  sessionId,
  claimId,
  commentRef,
  reservedAt,
  activeIssue = null,
  branch = null,
  mainSha,
  status = 'IDLE',
} = {}) {
  return Object.freeze({
    schemaVersion: IDENTITY_SCHEMA,
    identity,
    systemId,
    workspaceId,
    repository,
    sessionId,
    claimId,
    commentRef,
    reservedAt,
    activeIssue,
    branch,
    mainSha,
    status,
  });
}

export function readIdentityFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

/** Schreibt nur gueltige Datensaetze; der Pfad wird vorher geprueft. */
export function writeIdentityFile(path, record, { repoRoot } = {}) {
  if (repoRoot && isInsideRepository(path, repoRoot)) {
    throw new Error('WORKSPACE: identity.json darf nicht im Repository liegen');
  }
  const validation = validateIdentityFile(record);
  if (!validation.ok) throw new Error(`WORKSPACE: Identitaetsdatei ungueltig: ${validation.reasons.join(', ')}`);
  writeJsonAtomic(path, record);
  return path;
}

/** Kurzer, stabiler Hash fuer den Dependency-Fingerprint. */
export function shortHash(text) {
  return createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
}

export function readDependencyFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeDependencyFile(path, value) {
  writeJsonAtomic(path, value);
  return path;
}
