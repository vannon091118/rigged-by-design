/**
 * Reparaturplan: aus einem roten Lauf wird genau eine Entscheidung.
 *
 * Die Reihenfolge ist fest und fail-closed:
 *   nichts (NOOP/PR_HANDOFF) -> einmal wiederholen -> mechanisch reparieren
 *   -> Issue.
 *
 * Mechanisch heisst ausschliesslich Doku-Marker, Dependency-Matrix,
 * Testkatalog und Inventur. Produktcode, Tests und ESLint-Autofix bleiben beim
 * Agenten: ein Automatismus, der Code umschreibt, waere keine Reparatur, sondern
 * eine zweite Wahrheit. Ein Versuch pro SHA, markiert per `<!-- autofix: sha -->`.
 */
import { DOC_SET } from './doc-sync.mjs';
import { GATES } from './pipeline-plan.mjs';

/** Ein Versuch pro SHA; ein zweiter braucht einen neuen Commit. */
export const AUTOFIX_MAX_ATTEMPTS = 1;

/**
 * Die vier Generatoren. Sie schreiben nur abgeleitete Bereiche; `doc-sync`
 * setzt Marker, `sync-dependency-matrix` die Live-Matrix, `test-catalog` und
 * `build-inventory` den Inventarblock.
 */
export const AUTOFIX_SCRIPTS = Object.freeze([
  'scripts/doc-sync.mjs',
  'scripts/sync-dependency-matrix.mjs',
  'scripts/test-catalog.mjs',
  'scripts/build-inventory.mjs',
]);

/** Nur diese Pfade darf eine automatische Reparatur anfassen. */
export const MECHANICAL_PATHS = Object.freeze(
  [...new Set([...DOC_SET.map((doc) => doc.path), 'docs/INVENTORY.md', 'docs/ARCHITECTURE.md', 'docs/DEPENDENCY-MATRIX.md'])].sort(),
);

/** Codes, die als mechanisch gelten (Doku, Matrix, Katalog, Marker). */
export const MECHANICAL_CODES = Object.freeze(['ERR-0911', 'ERR-4013', 'ERR-4015', 'ERR-4017']);

const normalized = (value) => String(value ?? '').replaceAll('\\', '/');

export function isMechanicalPath(filePath) {
  return MECHANICAL_PATHS.includes(normalized(filePath));
}

/** Teilt einen Reparatur-Diff in erlaubte und fremde Pfade. */
export function filterPaths(paths) {
  const allowed = [];
  const foreign = [];
  for (const path of paths ?? []) {
    (isMechanicalPath(path) ? allowed : foreign).push(normalized(path));
  }
  return { allowed, foreign, ok: foreign.length === 0 };
}

/** Die Pfade, die ein Befund mechanisch nachziehen kann. */
export function requestedPaths(failures) {
  const paths = new Set();
  for (const failure of failures ?? []) {
    if (MECHANICAL_CODES.includes(failure?.code)) {
      if (failure.code === 'ERR-4013') paths.add('docs/DEPENDENCY-MATRIX.md');
      else if (failure.code === 'ERR-4015') paths.add('docs/INVENTORY.md');
      else for (const path of MECHANICAL_PATHS) paths.add(path);
    }
  }
  return [...paths].sort();
}

/** Gate-Name aus einem Befund: die Matrix benennt ihre Schritte `Gate <name>`. */
export function gateOf(failure) {
  const raw = String(failure?.step ?? failure?.gate ?? '');
  const match = /^Gate\s+([a-z0-9:_-]+)$/i.exec(raw.trim());
  return match?.[1] ?? null;
}

/**
 * Nur die betroffenen Gates werden nach der Reparatur erneut ausgefuehrt.
 * Ohne erkennbares Gate bleibt `docs`: der mechanische Pfad ist immer ein
 * Doku-/Generat-Pfad.
 */
export function affectedGates(failures) {
  const gates = new Set();
  for (const failure of failures ?? []) {
    const key = gateOf(failure);
    if (key && GATES[key]) gates.add(key);
    else if (MECHANICAL_CODES.includes(failure?.code)) gates.add('docs');
  }
  if (gates.size === 0) gates.add('docs');
  return [...gates].sort();
}

export function autofixMarker(sha) {
  return `<!-- autofix: ${sha} -->`;
}

export function hasAutofixMarker(body, sha) {
  if (!/^[0-9a-f]{40}$/.test(String(sha ?? ''))) return false;
  return new RegExp(`<!--\\s*autofix:\\s*${sha}\\s*-->`).test(String(body ?? ''));
}

/** Hoechstens ein Versuch pro SHA, auch ueber mehrere Laeufe hinweg. */
export function repairAttemptAllowed({ body = '', sha, attempts = 0 } = {}) {
  if (!/^[0-9a-f]{40}$/.test(String(sha ?? ''))) return false;
  if (Number(attempts) > AUTOFIX_MAX_ATTEMPTS) return false;
  return !hasAutofixMarker(body, sha);
}

/**
 * Die eine Entscheidung fuer einen roten Lauf.
 *
 * `state` kommt aus dem CI-Plan (NOOP/PR_HANDOFF pruefen nichts). Fork-PRs und
 * `main` werden nie automatisch repariert: dort fehlt die vertrauenswuerdige
 * Steuerung bzw. der Branch-Schutz ist die letzte Instanz.
 */
export function planResolution({
  state = null,
  conclusion = 'failure',
  failures = [],
  branch = '',
  sameRepo = true,
  fork = false,
  body = '',
  sha = '',
  attempts = 0,
} = {}) {
  const normalizedState = String(state ?? '').toUpperCase();
  const base = {
    state: normalizedState || null,
    marker: null,
    gates: [],
    paths: [],
  };
  if (normalizedState === 'NOOP' || normalizedState === 'PR_HANDOFF') {
    return { ...base, action: 'none', reason: `Zustand ${normalizedState} prueft nichts` };
  }
  if (!sameRepo || fork) {
    return { ...base, action: 'issue', reason: 'Fork-PR: keine vertrauenswuerdige Steuerung, kein Autofix' };
  }
  if (!branch || branch === 'main') {
    return { ...base, action: 'issue', reason: 'main oder ohne Branch: kein Autofix, Branch-Schutz entscheidet' };
  }
  if (['timed_out', 'cancelled', 'startup_failure'].includes(String(conclusion))) {
    return { ...base, action: 'rerun', reason: 'REMOTE_CI: Lauf ohne Ergebnis, einmal wiederholen' };
  }
  const red = (failures ?? []).filter((failure) => failure && failure.code);
  if (red.length === 0) {
    return { ...base, action: 'issue', reason: 'Kein Befund im Gate-Log lesbar' };
  }
  if (red.every((failure) => failure.level === 'REMOTE_CI')) {
    if (Number(attempts) >= 2) {
      return { ...base, action: 'none', reason: 'REMOTE_CI nach der Wiederholung: kein Gate-Issue, keine Lane-Blockade' };
    }
    return { ...base, action: 'rerun', reason: 'ausschliesslich transiente Befunde: einmal wiederholen' };
  }
  const mechanical = red.every(
    (failure) => failure.level === 'AUTO_FIX' || MECHANICAL_CODES.includes(failure.code),
  );
  if (!mechanical) {
    return { ...base, action: 'issue', reason: 'Befund ist nicht mechanisch: Produktcode bleibt beim Agenten' };
  }
  const marker = autofixMarker(sha);
  if (!repairAttemptAllowed({ body, sha, attempts })) {
    return { ...base, marker, action: 'issue', reason: 'Autofix fuer diesen SHA bereits versucht' };
  }
  return {
    ...base,
    action: 'repair',
    reason: 'mechanische Doku-/Generat-Pfade',
    marker,
    gates: affectedGates(red),
    paths: requestedPaths(red),
  };
}
