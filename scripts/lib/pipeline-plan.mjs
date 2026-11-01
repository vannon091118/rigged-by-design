/**
 * Der Plan jedes Laufs: `verify` liest ausschliesslich, `fix` repariert.
 *
 * Ein Gate, das Dateien schreibt, waere kein Gate. Deshalb kennt kein Profil
 * einen Autofix-Schritt; die Reparatur haengt allein an `--fix`. Die Gates
 * pruefen damit genau den Baum, den sie vorfinden, und melden jede Abweichung
 * als roten Befund, statt sie vorher wegzuschreiben.
 */

export const PROFILES = Object.freeze(['quick', 'full', 'release']);
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
  audit: { name: 'audit', command: 'pnpm', script: 'audit:gate', code: 'ERR-4004', timeoutMs: 3 * MINUTE },
  tests: { name: 'tests', command: 'pnpm', script: 'test:ci', code: 'ERR-2001', cache: true, timeoutMs: 15 * MINUTE },
  build: { name: 'build', command: 'pnpm', script: 'build', code: 'ERR-1005', cache: true, timeoutMs: 10 * MINUTE },
});

const QUICK = ['lint', 'check:loc', 'typecheck', 'test-quality', 'dead-code', 'docs', 'tree', 'redundancy', 'assets', 'tests'];

export const PROFILE_GATES = Object.freeze({
  quick: Object.freeze(QUICK),
  // Voll und Release pruefen identisch; nur `verify:release` erzwingt pnpm audit zusaetzlich per Env.
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
