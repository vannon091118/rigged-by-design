/**
 * Repository-Inventur: Bestaende werden am Remote erkannt, nicht am Ordnernamen.
 *
 * Ein Klon, ein Linked Worktree und ein umbenannter Ordner sind derselbe
 * Bestand, wenn ihr Remote normalisiert gleich ist. Die Inventur klassifiziert
 * jeden Bestand und markiert sie als unvollstaendig, sobald ein Pfad nicht
 * lesbar war — eine unvollstaendige Inventur erlaubt keine destruktive
 * Bereinigung.
 */

export const INVENTORY_STATUSES = Object.freeze([
  'MAIN_CLEAN',
  'MAIN_DIRTY',
  'WORKER_ACTIVE',
  'WORKER_DIRTY',
  'WORKER_UNPUSHED',
  'WORKER_REVIEW_PENDING',
  'WORKER_MERGED_PENDING_CLEANUP',
  'DUPLICATE_WORKTREE',
  'DUPLICATE_CLONE',
  'ORPHANED_WORKTREE',
  'UNKNOWN_OWNER',
  'IDENTITY_CONFLICT',
  'INVENTORY_INCOMPLETE',
]);

/** `https`, `ssh://` und `git@host:owner/repo` werden zu `host/owner/repo`. */
export function normalizeRemote(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(raw);
  const rest = scp && !raw.includes('://')
    ? `${scp[1]}/${scp[2]}`
    : raw.replace(/^[a-z+]+:\/\//i, '').replace(/^[^@/]+@/, '');
  return rest.replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

export function sameRepository(left, right) {
  const a = normalizeRemote(left);
  const b = normalizeRemote(right);
  return a !== '' && a === b;
}

function hasWork(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Klassifiziert einen Bestand. Reihenfolge ist Vertrag: zuerst Rolle, dann
 * offene Arbeit, dann Review, dann Dubletten; `INVENTORY_INCOMPLETE` gewinnt
 * immer, weil ohne vollstaendige Inventur keine Aussage sicher ist.
 */
export function classifyEntry({
  role = 'worker',
  branch = null,
  dirtyPaths = [],
  stagedPaths = [],
  untrackedPaths = [],
  stashCount = 0,
  unpushedCommits = 0,
  pr = null,
  identityConflict = false,
  duplicateOf = null,
  orphaned = false,
  readable = true,
} = {}) {
  if (!readable) return 'INVENTORY_INCOMPLETE';
  if (identityConflict) return 'IDENTITY_CONFLICT';
  if (orphaned) return 'ORPHANED_WORKTREE';
  if (duplicateOf) return role === 'worker' ? 'DUPLICATE_WORKTREE' : 'DUPLICATE_CLONE';
  if (role === 'main') {
    const clean = !hasWork(dirtyPaths) && !hasWork(stagedPaths) && !hasWork(untrackedPaths) && stashCount === 0;
    return clean && unpushedCommits === 0 ? 'MAIN_CLEAN' : 'MAIN_DIRTY';
  }
  if (pr && pr.state === 'OPEN' && pr.merged !== true) {
    const mergedByContent = pr.mergedShaOnMain === true;
    return mergedByContent ? 'WORKER_MERGED_PENDING_CLEANUP' : 'WORKER_REVIEW_PENDING';
  }
  if (hasWork(dirtyPaths) || hasWork(stagedPaths) || hasWork(untrackedPaths) || stashCount > 0) return 'WORKER_DIRTY';
  if (unpushedCommits > 0) return 'WORKER_UNPUSHED';
  if (branch === null) return 'UNKNOWN_OWNER';
  return 'WORKER_ACTIVE';
}

/**
 * Fasst Bestaende zusammen. `incomplete` bleibt gesetzt, wenn irgendein Pfad
 * nicht lesbar war; `cleanupAllowed` ist dann falsch.
 */
export function inventoryReport(entries = [], { unreadablePaths = [] } = {}) {
  const rows = entries.map((entry) => ({
    path: entry.path,
    status: classifyEntry(entry),
    role: entry.role ?? 'worker',
    branch: entry.branch ?? null,
    pr: entry.pr?.number ?? null,
  }));
  const byStatus = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  const incomplete = unreadablePaths.length > 0 || rows.some((row) => row.status === 'INVENTORY_INCOMPLETE');
  const duplicatePaths = entries.filter((entry) => entry.duplicateOf).map((entry) => entry.path);
  return {
    rows,
    byStatus,
    incomplete,
    unreadablePaths: [...unreadablePaths],
    duplicates: duplicatePaths,
    cleanupAllowed: !incomplete && duplicatePaths.length === 0,
    twoWorktrees: rows.filter((row) => row.role === 'main').length === 1
      && rows.filter((row) => row.role === 'worker').length === 1,
  };
}
