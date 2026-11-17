/**
 * Diff-Zeilen einer Datei und der mechanische Systempfad (Doku-Marker,
 * Versionszeile). Dieselbe Auslegung fuer Gate und turn:finish.
 */
export const SYSTEM_LINE = /^[+-]\s*(<!--\s*rbd-doc:.*-->|"version":\s*".*",?|version:\s*\S+)\s*$/;

/** Geaenderte Diff-Zeilen einer Datei; `null` heisst: Diff nicht lesbar. */
export function diffLines(file, { git, diffBase = null } = {}) {
  let diff;
  try {
    diff = diffBase
      ? git(['diff', '--unified=0', diffBase, '--', file])
      : git(['diff', '--cached', '--unified=0', '--', file]);
  } catch {
    return null;
  }
  return diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
}

/**
 * Gestapelte Lanes: der Claim nennt seinen `baseSha`; er zaehlt nur, wenn er
 * Vorfahre von HEAD und in einem Remote-Ref enthalten ist. Ein explizites
 * BASE_REF gewinnt.
 */
export function stackedBase({ declared, headRef, defaultBase, git }) {
  const sha = String(declared?.baseSha ?? '');
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return defaultBase;
  try {
    git(['merge-base', '--is-ancestor', sha, headRef]);
  } catch {
    return defaultBase;
  }
  const remote = git(['branch', '-r', '--contains', sha]);
  return remote ? sha : defaultBase;
}

/** Staged, merged und geloeschte Pfade in einem Zug aus dem Diff lesen. */
export function collectDiffScope({ git, diffBase, ci, merging, allClaims }) {
  const staged = (diffBase
    ? git(['diff', '--name-only', '--diff-filter=ACMR', diffBase])
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  ).split(/\r?\n/).filter(Boolean);
  const mergedClaims = (ci || merging) ? allClaims.filter((c) => c.status === 'merged') : [];
  const deletedFiles = new Set((diffBase
    ? git(['diff', '--name-only', '--diff-filter=D', diffBase])
    : git(['diff', '--cached', '--name-only', '--diff-filter=D'])
  ).split(/\r?\n/).filter(Boolean));
  return { staged, mergedClaims, deletedFiles };
}

export function onlySystemLines(file, options) {
  const changed = diffLines(file, options);
  if (changed === null) return false;
  if (changed.length === 0) return true;
  return changed.every((line) => SYSTEM_LINE.test(line));
}
