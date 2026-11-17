/**
 * Merge-Drift: Code ohne Doku ist ein Befund, kein Hinweis.
 *
 * Die Regel ist bewusst schmal, damit sie den Ablauf nicht bremst und nicht
 * bei jeder Tool-Aenderung feuert:
 * - Code in `src/`, `content/` oder `public/` verlangt eine Zeile in
 *   `LAST-CHANGES.md`.
 * - Spiel-Hot-Zones (`src/core`, `src/store`, `src/render`, `src/ui`) verlangen
 *   zusaetzlich eine Aktualisierung der `ROADMAP.md`.
 * - `src/core/governance/` ist die Testbruecke (Dev), keine Spiel-Hot-Zone.
 * - Reine Doku-, Claim- und Hook-Aenderungen sind frei.
 *
 * Die Pruefung liest nur die Dateiliste; sie ruft keine Generatoren und keine
 * Tests. Damit kostet sie im Hook wenige Millisekunden.
 */
export const LAST_CHANGES = 'docs/governance/LAST-CHANGES.md';
export const ROADMAP = 'docs/governance/ROADMAP.md';

export const CODE_ZONE = /^(?:src|content|public)\//;
export const GAME_HOT_ZONE = /^src\/(?:core|store|render|ui)\//;
export const DEV_TEST_BRIDGE = /^src\/core\/governance\//;
/** Generierte oder abgeleitete Dateien zaehlen nicht als Code-Aenderung. */
export const GENERATED = /(?:\.generated\.ts|registry\/fragments\.json|^public\/assets\/)/;

const norm = (path) => String(path ?? '').split('\\').join('/');

/** Die Befunde fuer eine Liste geaenderter Pfade; leer heisst gruen. */
export function driftProblems(files = []) {
  const changed = [...new Set(files.map(norm).filter(Boolean))];
  const code = changed.filter(
    (path) => CODE_ZONE.test(path) && !DEV_TEST_BRIDGE.test(path) && !GENERATED.test(path),
  );
  const hot = code.filter((path) => GAME_HOT_ZONE.test(path) && !DEV_TEST_BRIDGE.test(path));
  const problems = [];

  if (code.length > 0 && !changed.includes(LAST_CHANGES)) {
    problems.push(
      `Code geaendert (${code.slice(0, 4).join(', ')}${code.length > 4 ? ', ...' : ''}), aber ${LAST_CHANGES} fehlt im selben Commit.`,
    );
  }
  if (hot.length > 0 && !changed.includes(ROADMAP)) {
    problems.push(
      `Spiel-Hot-Zone geaendert (${hot.slice(0, 4).join(', ')}${hot.length > 4 ? ', ...' : ''}), aber ${ROADMAP} fehlt im selben Commit.`,
    );
  }
  return problems;
}

/** Geaenderte Pfade aus dem Index (pre-commit) oder gegen eine Basis (pre-push). */
export function changedPaths({ staged = false, base = null } = {}, exec) {
  const run = (args) => String(exec('git', args) ?? '').trim().split('\n').filter(Boolean);
  if (staged) return run(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (!base) return [];
  try {
    return run(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  } catch {
    return [];
  }
}

/** Kurzer Text fuer den Hook; nennt die Regel und den naechsten Schritt. */
export function driftMessage(problems) {
  return [
    'Doku-Drift blockiert (ERR-4023):',
    ...problems.map((problem) => `- ${problem}`),
    'Trage die Aenderung in die Pflichtdoku ein (eine Zeile genuegt) und committe erneut.',
  ].join('\n');
}
