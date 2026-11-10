/**
 * Integration: entscheidet vor der teuren CI, ob ein Branch ueberhaupt
 * integrierbar ist, und warum nicht.
 *
 * Drei Zustaende, drei Reparaturwege:
 * - `READY`: Basis ist enthalten, kein Konflikt. Die Gates duerfen starten.
 * - `REBASE_REQUIRED`: Branch ist hinter `main` oder kollidiert ausschliesslich
 *   in generierten Artefakten. Reparatur: rebasen und regenerieren.
 * - `MANUAL_CONFLICT`: mindestens eine Handdatei kollidiert. Keine Bot-Chirurgie.
 *
 * Die Funktionen sind bewusst rein: Git-Zugriff und Bewertung sind getrennt,
 * damit die Grenzen ohne Netz und ohne Repo testbar bleiben.
 */
import { execFileSync } from 'node:child_process';
import { classifyConflicts } from './generated-files.mjs';

export const INTEGRATION = Object.freeze({
  READY: 'READY',
  REBASE_REQUIRED: 'REBASE_REQUIRED',
  MANUAL_CONFLICT: 'MANUAL_CONFLICT',
});

/** Exit-Codes des Controllers; 0 heisst READY. */
export const EXIT = Object.freeze({ READY: 0, REBASE_REQUIRED: 2, MANUAL_CONFLICT: 3 });

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Konfliktpfade zweier Commits. `known: false` heisst: die Pruefung war nicht
 * moeglich (alte Git-Version, fehlende Objekte) und wird fail-closed behandelt.
 */
export function mergeConflicts({ base, head, cwd } = {}) {
  if (!base || !head) return { known: false, conflicts: [] };
  try {
    const out = git(['merge-tree', '--write-tree', '--name-only', base, head], cwd);
    return { known: true, conflicts: out.split(/\r?\n/).slice(1).filter(Boolean) };
  } catch (error) {
    const out = String(error?.stdout ?? '').trim();
    if (!out) return { known: false, conflicts: [] };
    // Bei Konflikten liefert merge-tree Exit 1 und die Liste auf stdout.
    const lines = out.split(/\r?\n/).filter(Boolean);
    return { known: true, conflicts: lines.slice(1) };
  }
}

/** Reine Bewertung: alles, was der Controller fuer eine Entscheidung braucht. */
export function assessIntegration({ behind = 0, ahead = 0, conflicts = [], known = true } = {}) {
  const list = [...new Set(conflicts ?? [])];
  const classified = classifyConflicts(list);
  if (!known) {
    return {
      status: INTEGRATION.MANUAL_CONFLICT,
      behind,
      ahead,
      conflicts: list,
      generated: classified.generated,
      source: classified.source,
      reason: 'Konfliktpruefung nicht moeglich; fail-closed',
    };
  }
  if (classified.source.length > 0) {
    return {
      status: INTEGRATION.MANUAL_CONFLICT,
      behind,
      ahead,
      conflicts: list,
      generated: classified.generated,
      source: classified.source,
      reason: 'Konflikt in Handdateien; keine automatische Reparatur',
    };
  }
  if (classified.generated.length > 0) {
    return {
      status: INTEGRATION.REBASE_REQUIRED,
      behind,
      ahead,
      conflicts: list,
      generated: classified.generated,
      source: [],
      reason: 'nur generierte Artefakte kollidieren; rebasen und regenerieren',
    };
  }
  if (behind > 0) {
    return {
      status: INTEGRATION.REBASE_REQUIRED,
      behind,
      ahead,
      conflicts: list,
      generated: [],
      source: [],
      reason: `Branch ist ${behind} Commit(s) hinter der Basis`,
    };
  }
  return {
    status: INTEGRATION.READY,
    behind,
    ahead,
    conflicts: [],
    generated: [],
    source: [],
    reason: 'Basis enthalten, kein Konflikt',
  };
}

/** Zaehlt Commits, die der Branch hinter `base` zurueckliegt. */
function behindAhead({ base, head, cwd }) {
  const count = (range) => {
    try {
      return Number(git(['rev-list', '--count', range], cwd).trim());
    } catch {
      return null;
    }
  };
  const behind = count(`${head}..${base}`);
  const ahead = count(`${base}..${head}`);
  return { behind: behind ?? null, ahead: ahead ?? null };
}

/** Status eines Branches gegen eine Basis. */
export function integrationStatus({ base = 'origin/main', head = 'HEAD', cwd } = {}) {
  const resolve = (ref) => {
    try {
      return git(['rev-parse', '--verify', `${ref}^{commit}`], cwd).trim();
    } catch {
      return null;
    }
  };
  const baseSha = resolve(base);
  const headSha = resolve(head);
  if (!baseSha || !headSha) {
    return assessIntegration({ known: false });
  }
  const counts = behindAhead({ base: baseSha, head: headSha, cwd });
  if (counts.behind === null) return assessIntegration({ known: false });
  const merged = mergeConflicts({ base: baseSha, head: headSha, cwd });
  const verdict = assessIntegration({
    behind: counts.behind,
    ahead: counts.ahead,
    conflicts: merged.conflicts,
    known: merged.known,
  });
  return { ...verdict, baseSha, headSha };
}
