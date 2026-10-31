/**
 * Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert.
 *
 * Ein Gate, das Dateien schreibt, waere kein Gate. Deshalb kennt kein Profil
 * einen Autofix-Schritt; die Reparatur haengt allein an `--fix`. Die Gates
 * pruefen damit genau den Baum, den sie vorfinden, und melden jede Abweichung
 * als roten Befund, statt sie vorher wegzuschreiben.
 */

export const PROFILES = Object.freeze(['quick', 'full', 'release']);

/** Jede Stufe ist rein lesend: pruefen, nicht reparieren. */
export const GATES = Object.freeze({
  lint: { name: 'lint', command: 'npm', script: 'lint', code: 'ERR-4011', cache: true },
  'check:loc': { name: 'check:loc', command: 'npm', script: 'check:loc', code: 'ERR-4012', cache: true },
  typecheck: { name: 'typecheck', command: 'npm', script: 'typecheck', code: 'ERR-1005', cache: true },
  'test-quality': {
    name: 'test-quality',
    command: 'node',
    script: 'scripts/verify-test-quality.mjs',
    code: 'ERR-4002',
    cache: true,
  },
  'dead-code': {
    name: 'dead-code',
    command: 'node',
    script: 'scripts/verify-dead-code.mjs',
    code: 'ERR-4003',
    cache: true,
  },
  // Die Matrix wird hier nur geprueft; geschrieben wird sie ausschliesslich im Fix-Modus.
  'deps-matrix': {
    name: 'deps-matrix',
    command: 'node',
    script: 'scripts/sync-dependency-matrix.mjs',
    args: ['--check'],
    code: 'ERR-4013',
    cache: true,
  },
  audit: { name: 'audit', command: 'npm', script: 'audit:gate', code: 'ERR-4004' },
  tests: { name: 'tests', command: 'npm', script: 'test:ci', code: 'ERR-2001', cache: true },
  build: { name: 'build', command: 'npm', script: 'build', code: 'ERR-1005', cache: true },
});

const QUICK = ['lint', 'check:loc', 'typecheck', 'test-quality', 'dead-code', 'deps-matrix', 'tests'];

export const PROFILE_GATES = Object.freeze({
  quick: Object.freeze(QUICK),
  // Voll und Release pruefen identisch; nur `verify:release` erzwingt npm audit zusaetzlich per Env.
  full: Object.freeze([...QUICK, 'audit', 'build']),
  release: Object.freeze([...QUICK, 'audit', 'build']),
});

export function isProfile(value) {
  return PROFILES.includes(value);
}

/** Der Gate-Plan eines Profils; `null` fuer ein unbekanntes Profil. */
export function planGates(profile) {
  if (!isProfile(profile)) return null;
  return [...PROFILE_GATES[profile]];
}

/** `--fix` ist der einzige Schalter, der den Arbeitsbaum schreiben darf. */
export function isFixMode(argv) {
  return [...argv].includes('--fix');
}
