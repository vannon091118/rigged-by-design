/**
 * Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert.
 *
 * Ein Gate, das Dateien schreibt, waere kein Gate. Deshalb kennt kein Profil
 * einen Autofix-Schritt; die Reparatur haengt allein an `--fix`. Die Gates
 * pruefen damit genau den Baum, den sie vorfinden, und melden jede Abweichung
 * als roten Befund, statt sie vorher wegzuschreiben.
 */

export const PROFILES = Object.freeze(['light', 'dev', 'quick', 'full', 'release']);

/**
 * `verify:all` heisst fuer Menschen "alles", als Profil heisst es `full`. Der
 * Alias steht genau einmal hier: CI, Matrix und Pipeline lesen denselben Namen,
 * statt je eigene Schreibweisen zu erfinden.
 */
export const PROFILE_ALIASES = Object.freeze({ all: 'full' });

export function normalizeProfile(value) {
  return PROFILE_ALIASES[value] ?? value;
}
const MINUTE = 60_000;

/** Jede Stufe ist rein lesend: pruefen, nicht reparieren. */
export const GATES = Object.freeze({
  lint: { name: 'lint', command: 'pnpm', script: 'lint', code: 'ERR-4011', cache: true, timeoutMs: 2 * MINUTE },
  'check:loc': { name: 'check:loc', command: 'pnpm', script: 'check:loc', code: 'ERR-4012', cache: true, timeoutMs: MINUTE },
  typecheck: { name: 'typecheck', command: 'pnpm', script: 'typecheck', code: 'ERR-1005', cache: true, timeoutMs: 3 * MINUTE },
  'test-quality': {
    name: 'test-quality',
    command: 'node',
    script: 'scripts/verify-test-quality.mjs',
    code: 'ERR-4002',
    cache: true,
    timeoutMs: 2 * MINUTE,
  },
  'dead-code': {
    name: 'dead-code',
    command: 'node',
    script: 'scripts/verify-dead-code.mjs',
    code: 'ERR-4003',
    cache: true,
    timeoutMs: 2 * MINUTE,
  },
  // Pflichtdoku: Struktur, Marker, flacher Wurzelbaum. Matrix und Katalog
  // werden nicht mehr gegated; der Pre-Commit-Hook schreibt sie.
  docs: {
    name: 'docs',
    command: 'node',
    script: 'scripts/verify-docs.mjs',
    code: 'ERR-4017',
    cache: true,
    timeoutMs: MINUTE,
  },
  tree: {
    name: 'tree',
    command: 'node',
    script: 'scripts/verify-tree.mjs',
    code: 'ERR-4019',
    cache: true,
    timeoutMs: MINUTE,
  },
  redundancy: {
    name: 'redundancy',
    command: 'node',
    script: 'scripts/verify-redundancy.mjs',
    code: 'ERR-4020',
    cache: true,
    timeoutMs: MINUTE,
  },
  assets: { name: 'assets', command: 'pnpm', script: 'verify:assets', code: 'ERR-4016', cache: true, timeoutMs: 2 * MINUTE },
  capabilities: { name: 'capabilities', command: 'node', script: 'scripts/verify-capabilities.mjs', code: 'ERR-4025', cache: true, timeoutMs: MINUTE },
  audit: { name: 'audit', command: 'pnpm', script: 'audit:gate', code: 'ERR-4004', timeoutMs: 3 * MINUTE },
  // Ein roter Test ist ein Befund, kein Notfall: ERR-4026 steht auf AGENT und
  // wird als Issue abgeholt. Nur Geld-, Ledger-, RNG- und Save-Invarianten
  // bleiben BLOCKED (ERR-1001/1002/1003/5001).
  tests: { name: 'tests', command: 'pnpm', script: 'test:ci', code: 'ERR-4026', cache: true, timeoutMs: 15 * MINUTE },
  // Derselbe Selektor wie `test:affected`, aber als Gate im gemeinsamen Plan.
  // Der lokale dev-Abschluss soll nicht zwei getrennte Testkommandos brauchen.
  affected: { name: 'affected', command: 'node', script: 'scripts/test-affected.mjs', code: 'ERR-4026', cache: true, timeoutMs: 15 * MINUTE },
  build: { name: 'build', command: 'pnpm', script: 'build', code: 'ERR-1005', cache: true, timeoutMs: 10 * MINUTE },
});

// Lokal waehrend der Arbeit: keine Suite, kein Build, kein Audit. Der Beweis
// gehoert nach GitHub Actions, nicht in jeden Agenten-Turn.
const LIGHT = ['lint', 'check:loc', 'typecheck', 'docs', 'tree', 'redundancy'];
const DEV = [...LIGHT, 'affected'];
// Quick ist die gemeinsame Basis fuer den Required-Set; Build kommt fuer CI
// hinzu, Audit bleibt impact-/release-abhaengig.
export const QUICK_GATES = Object.freeze([
  'lint',
  'check:loc',
  'typecheck',
  'test-quality',
  'dead-code',
  'docs',
  'tree',
  'redundancy',
  'assets',
  'capabilities',
  'tests',
]);
export const REQUIRED_CI_GATES = Object.freeze([...QUICK_GATES, 'build']);
export const LIGHT_GATES = Object.freeze(LIGHT);
export const CI_STATES = Object.freeze([
  'PR',
  'MAIN',
  'MANUAL',
  'LIGHT',
  'NOOP',
  'PR_HANDOFF',
  'UNKNOWN',
]);
/** Die Gates, die ein Zustand verlangt; `null` fuer einen unbekannten Zustand. */
export function gatesForState(state) {
  switch (String(state ?? '').toUpperCase()) {
    case 'PR':
    case 'MAIN':
    case 'MANUAL':
      return [...REQUIRED_CI_GATES];
    case 'UNKNOWN':
      return [...REQUIRED_CI_GATES, 'audit'];
    case 'LIGHT':
      return [...LIGHT_GATES];
    case 'NOOP':
    case 'PR_HANDOFF':
      return [];
    default:
      return null;
  }
}

export const PROFILE_GATES = Object.freeze({
  light: LIGHT_GATES,
  dev: Object.freeze(DEV),
  quick: QUICK_GATES,
  // Voll und Release pruefen identisch; Release erzwingt Audit zusaetzlich per Env.
  full: Object.freeze([...REQUIRED_CI_GATES, 'audit']),
  release: Object.freeze([...REQUIRED_CI_GATES, 'audit']),
});

export function isProfile(value) {
  return PROFILES.includes(normalizeProfile(value));
}

/** Der Gate-Plan eines Profils; `null` fuer ein unbekanntes Profil. */
export function planGates(profile) {
  const key = normalizeProfile(profile);
  if (!PROFILES.includes(key)) return null;
  return [...PROFILE_GATES[key]];
}

/** Ein Zustandsname oder `null`, nie ein stiller Fallback auf ein Profil. */
export function isCIState(value) {
  return CI_STATES.includes(String(value ?? '').toUpperCase());
}

/** `--fix` ist der einzige Schalter, der den Arbeitsbaum schreiben darf. */
export function isFixMode(argv) {
  return [...argv].includes('--fix');
}
