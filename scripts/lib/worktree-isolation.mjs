/**
 * Technische Worktree-Isolation fuer Agenten.
 *
 * Ein geteilter Arbeitsbaum ist kein Startort fuer eine Lane. Jeder Branch
 * ausser `main` braucht einen eigenen verknuepften Worktree; zusaetzlich
 * blockiert ein fremder offener Claim oder ein explizites `--require-worktree`.
 * Die Entscheidung liegt hier und wird von `pretask` nur noch mit
 * Git-Zustand gefuettert, damit sie testbar bleibt.
 */
import { resolve } from 'node:path';
import { allowsPath } from './lane-claims.mjs';

/** Maschinenlesbarer Code fuer einen Start in einem geteilten Arbeitsbaum. */
export const ISOLATION_CODE = 'ERR-4019';

/** Ein verknuepfter Worktree hat ein eigenes Git-Dir, aber ein gemeinsames Common-Dir. */
export function isLinkedWorktree(gitDir, commonDir) {
  if (!gitDir || !commonDir) return false;
  return resolve(gitDir) !== resolve(commonDir);
}

/** Pfade aus `git status --porcelain`; bei Renames zaehlen beide Seiten. */
export function parseStatusPaths(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line) => {
      const payload = line.slice(2).trim();
      return payload
        .split(' -> ')
        .map((entry) => entry.trim().replace(/^"(.*)"$/, '$1'))
        .filter(Boolean);
    });
}

/**
 * Isolation ist fuer jede Lane gefordert: ein Branch ausser `main` braucht
 * einen eigenen Worktree, auch wenn gerade kein fremder Claim offen ist.
 * `main` bleibt ausgenommen; dort blockiert nur ein fremder offener Claim.
 */
export function isolationRequired({ explicit = false, claims = [], branch = '' } = {}) {
  if (explicit) return true;
  if (branch !== 'main') return true;
  return claims.some((claim) => claim.status === 'open' && claim.branch !== branch);
}

/**
 * Pfade im Arbeitsbaum, die eine fremde offene Lane beansprucht. Der eigene
 * Claim hat Vorrang: eine Ueberschneidung in Meta- oder Koordinationspfaden
 * macht die eigene Aenderung nicht fremd. Nur Pfade, die ausschliesslich eine
 * fremde Lane fuehrt, blockieren.
 */
export function foreignClaimPaths({ changed = [], claims = [], branch = '', ownAllowlist = [] } = {}) {
  const foreign = claims.filter((claim) => claim.status === 'open' && claim.branch !== branch);
  const owned = new Set();
  for (const claim of foreign) {
    const allowlist = claim.pathAllowlist ?? [];
    for (const file of changed) {
      if (allowsPath(allowlist, file) && !allowsPath(ownAllowlist, file)) owned.add(file);
    }
  }
  return [...owned].sort();
}

/**
 * Bewertet den Startort. Ein verknuepfter Worktree passiert immer; ein
 * geteilter Arbeitsbaum blockiert, sobald Isolation gefordert ist. Schmutz
 * und fremde Claim-Pfade werden zusaetzlich als Gruende genannt, damit der
 * Fehler nicht nur "irgendwie geteilt" sagt.
 */
export function assessIsolation({
  required = false,
  isWorktree = false,
  dirtyPaths = [],
  foreignPaths = [],
  branch = '',
} = {}) {
  const base = {
    code: ISOLATION_CODE,
    required,
    isWorktree,
    branch,
    dirtyPaths: [...dirtyPaths],
    foreignPaths: [...foreignPaths],
  };
  if (!required || isWorktree) return { ...base, ok: true, reasons: [] };

  const reasons = ['shared-worktree'];
  if (dirtyPaths.length > 0) reasons.push('dirty-shared-tree');
  if (foreignPaths.length > 0) reasons.push('foreign-claim-paths');
  return { ...base, ok: false, reasons };
}
