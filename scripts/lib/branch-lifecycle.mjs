/**
 * Branch-/Worktree-Lifecycle: jede Branch ausser `main` ist temporaer.
 *
 * Nach einem belegten Merge wird die Branch remote von der CI geloescht; lokal
 * bleibt sie nur, bis `planCleanup` sie als Wegwerf-Branch erkennt. Entfernt
 * wird ausschliesslich, was einen Merge-Beleg hat (`merged` aus
 * `git branch --merged <basis>`), nie offene Arbeit ohne Beleg. Worktrees
 * werden nur geprunt, wenn Git sie selbst als `prunable` meldet.
 *
 * Die Funktion plant; sie fuehrt nichts aus. `pretask` nutzt sie lesend und
 * raeumt hoechstens administrative Worktree-Reste mit `git worktree prune` auf.
 */
export const PROTECTED_BRANCHES = Object.freeze(['main']);

/**
 * Liest `git worktree list --porcelain`. Bloecke sind durch Leerzeilen
 * getrennt; relevant sind Pfad, Branch und die `prunable`-Zeile.
 */
export function parseWorktrees(text) {
  const worktrees = [];
  let current = null;
  const flush = () => {
    if (current) worktrees.push(current);
    current = null;
  };
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const space = line.indexOf(' ');
    const key = space === -1 ? line : line.slice(0, space);
    const value = space === -1 ? '' : line.slice(space + 1).trim();
    if (key === 'worktree') {
      flush();
      current = { path: value, branch: null, head: null, prunable: false };
      continue;
    }
    if (!current) continue;
    if (key === 'HEAD') current.head = value;
    else if (key === 'branch') current.branch = value.replace(/^refs\/heads\//, '');
    else if (key === 'prunable') current.prunable = true;
  }
  flush();
  return worktrees;
}

/**
 * Plant Loeschen, Behalten und Prunen.
 *
 * `delete` enthaelt nur Branches mit Merge-Beleg, die weder geschuetzt noch der
 * aktuelle Branch sind und keinen aktiven Worktree mehr haben. `prune` enthaelt
 * die Pfade, die Git als verwaist meldet. Alles andere bleibt mit Begruendung.
 */
export function planCleanup({
  branches = [],
  worktrees = [],
  current = '',
  protected: protectedNames = PROTECTED_BRANCHES,
} = {}) {
  const live = new Set(
    worktrees.filter((worktree) => !worktree.prunable && worktree.branch).map((worktree) => worktree.branch),
  );
  const prune = [...new Set(worktrees.filter((worktree) => worktree.prunable).map((worktree) => worktree.path))].sort();
  const remove = [];
  const keep = [];
  for (const raw of branches) {
    const name = typeof raw === 'string' ? raw : raw?.name;
    if (!name) continue;
    if (protectedNames.includes(name)) {
      keep.push({ name, reason: 'geschuetzt' });
      continue;
    }
    if (name === current) {
      keep.push({ name, reason: 'aktueller Branch' });
      continue;
    }
    if (live.has(name)) {
      keep.push({ name, reason: 'aktiver Worktree' });
      continue;
    }
    if (typeof raw === 'object' && raw?.merged === true) {
      remove.push(name);
      continue;
    }
    keep.push({ name, reason: 'offene Arbeit ohne Merge-Beleg' });
  }
  return { delete: remove.sort(), keep, prune };
}
