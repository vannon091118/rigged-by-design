/**
 * Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert.
 *
 * Ein Gate, das Dateien schreibt, waere kein Gate. Deshalb kennt kein Profil
 * einen Autofix-Schritt; die Reparatur haengt allein an `--fix`.
 *
 * Mechanik-Nachweise (Statistik, Soak, Langlauf, Benchmarks) sind kein Gate:
 * Sie laufen ausschliesslich im Profil `mechanics`. Der Regellauf bleibt
 * deterministisch schnell und kann nicht an einem Langlauf haengen.
 */

export const PROFILES = Object.freeze(['light', 'fast', 'dev', 'quick', 'integration', 'full', 'release', 'mechanics']);

/**
 * `verify:all` heisst fuer Menschen "alles", als Profil heisst es `full`. Der
 * Alias steht genau einmal hier: CI, Matrix und Pipeline lesen denselben Namen.
 */
export const PROFILE_ALIASES = Object.freeze({ all: 'full' });

export function normalizeProfile(value) {
  return PROFILE_ALIASES[value] ?? value;
}

const NODE = Object.freeze({ command: 'node' });

/** Jede Stufe ist rein lesend: pruefen, nicht reparieren. Kein Gate hat ein Zeitlimit. */
export const GATES = Object.freeze({
  lint: {
    ...NODE,
    name: 'lint',
    script: 'node_modules/eslint/bin/eslint.js',
    args: ['.', '--config', 'src/Config/eslint.config.mjs'],
    code: 'ERR-4011',
    cache: true,
  },
  'check:loc': { ...NODE, name: 'check:loc', script: 'scripts/check-loc.mjs', code: 'ERR-4012', cache: true },
  typecheck: {
    ...NODE,
    name: 'typecheck',
    script: 'node_modules/typescript/bin/tsc',
    args: ['--noEmit', '-p', 'src/Config/tsconfig.json'],
    code: 'ERR-1005',
    cache: true,
  },
  'test-quality': {
    ...NODE,
    name: 'test-quality',
    script: 'scripts/verify-test-quality.mjs',
    code: 'ERR-4002',
    cache: true,
  },
  'dead-code': { ...NODE, name: 'dead-code', script: 'scripts/verify-dead-code.mjs', code: 'ERR-4003', cache: true },
  // Pflichtdoku: Struktur, Marker, flacher Wurzelbaum.
  docs: { ...NODE, name: 'docs', script: 'scripts/verify-docs.mjs', code: 'ERR-4017', cache: true },
  // Der Katalog ist abgeleitet, aber im Verify nicht selbstschreibend.
  catalog: {
    ...NODE,
    name: 'catalog',
    script: 'scripts/test-catalog.mjs',
    args: ['--check'],
    code: 'ERR-4015',
    cache: true,
  },
  'test-placement': { ...NODE, name: 'test-placement', script: 'scripts/verify-test-placement.mjs', code: 'ERR-4019', cache: true },
  tree: { ...NODE, name: 'tree', script: 'scripts/verify-tree.mjs', code: 'ERR-4019', cache: true },
  // Der Impact-Pfad muss ohne `node_modules` laufen.
  'impact-graph': { ...NODE, name: 'impact-graph', script: 'scripts/verify-impact-graph.mjs', code: 'ERR-4019', cache: true },
  redundancy: { ...NODE, name: 'redundancy', script: 'scripts/verify-redundancy.mjs', code: 'ERR-4020', cache: true },
  assets: { ...NODE, name: 'assets', script: 'scripts/verify-assets.mjs', code: 'ERR-4016', cache: true },
  capabilities: { ...NODE, name: 'capabilities', script: 'scripts/verify-capabilities.mjs', code: 'ERR-4025', cache: true },
  narrative: { ...NODE, name: 'narrative', script: 'scripts/verify-narrative-blocks.mjs', code: 'ERR-4022', cache: true },
  audit: { name: 'audit', command: 'pnpm', script: 'audit:gate', code: 'ERR-4004' },
  // Ein roter Test ist ein Befund, kein Notfall: ERR-4026 steht auf AGENT und
  // wird als Issue abgeholt. Nur Geld-, Ledger-, RNG- und Save-Invarianten
  // bleiben BLOCKED (ERR-1001/1002/1003/5001).
  tests: {
    ...NODE,
    name: 'tests',
    script: 'scripts/run-selected-tests.mjs',
    env: { RBD_TEST_PROFILE: 'full' },
    code: 'ERR-4026',
    cache: true,
  },
  // Dieselbe Datei waehlt die betroffenen Tests, ohne die volle Suite zu starten.
  affected: { ...NODE, name: 'affected', script: 'scripts/test-affected.mjs', code: 'ERR-4026', cache: true },
  // Mechanik ist ein ausdruecklicher Nachweis, kein Bestandteil eines Profils.
  mechanics: {
    ...NODE,
    name: 'mechanics',
    script: 'scripts/run-selected-tests.mjs',
    env: { RBD_TEST_PROFILE: 'mechanics' },
    code: 'ERR-4026',
    cache: false,
  },
  build: {
    ...NODE,
    name: 'build',
    script: 'node_modules/vite/bin/vite.js',
    args: ['build', '--config', 'src/Config/vite.config.ts'],
    code: 'ERR-1005',
    cache: true,
  },
});

// Lokal waehrend der Arbeit: keine Suite, kein Build, kein Audit.
const LIGHT = ['lint', 'check:loc', 'typecheck', 'docs', 'catalog', 'test-placement', 'tree', 'impact-graph', 'redundancy'];
// Fast ist der lokale Standard vor dem Push: Struktur, Testqualitaet,
// betroffene Tests und ein schneller Build. Keine volle Suite, kein Audit.
const FAST = [...LIGHT, 'dead-code', 'test-quality', 'affected', 'build'];
const DEV = [...LIGHT, 'affected'];
// Quick ist die gemeinsame Basis fuer das Required-Set; Build kommt fuer CI
// hinzu, Audit bleibt impact-/release-abhaengig.
export const QUICK_GATES = Object.freeze([
  'lint',
  'check:loc',
  'typecheck',
  'test-quality',
  'dead-code',
  'docs',
  'catalog',
  'tree',
  'impact-graph',
  'redundancy',
  'assets',
  'capabilities',
  'narrative',
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
  fast: Object.freeze(FAST),
  dev: Object.freeze(DEV),
  quick: QUICK_GATES,
  // Vor dem PR reicht der lokale Fast-Nachweis.
  integration: FAST,
  // Voll und Release pruefen identisch; Release erzwingt Audit zusaetzlich per Env.
  full: Object.freeze([...REQUIRED_CI_GATES, 'audit']),
  release: Object.freeze([...REQUIRED_CI_GATES, 'audit']),
  // Nur die ausdruecklichen Mechanik-Nachweise; nie Teil eines Regellaufs.
  mechanics: Object.freeze(['mechanics']),
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
