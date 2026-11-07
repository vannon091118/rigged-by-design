/**
 * CI-Plan: der echte Diff entscheidet, welche Gates und Tests laufen.
 *
 * Die Analyse selbst liegt in `affected-tests.mjs` (Importgraph, Testziele),
 * `test-catalog.mjs` (Beweisklassen), `dependency-change.mjs` (Audit) und
 * `pipeline-plan.mjs` (Gate-Liste). Dieses Modul fuehrt sie zusammen; es
 * erfindet keine Metadaten und keine zweite Impact-Wahrheit.
 *
 * Grundsaetze:
 * - Unbekannter oder nicht bestimmbarer Diff -> volles Profil (fail-closed).
 * - Reine Doku/Governance -> Doku-, Tree-, Redundanz- und LOC-Gate, kein
 *   Typecheck, kein Build, kein Testlauf, kein Audit.
 * - Dependencies, Lockfile oder Toolchain -> volles Profil inklusive Audit.
 * - Statistik, Soak, Balance und Benchmarks sind Advisory und stehen nie in
 *   der Required-Matrix; sie laufen in `long-checks.yml`.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './report.mjs';
import { selectAffectedTests } from './affected-tests.mjs';
import { partitionByProof } from './test-catalog.mjs';
import { GATES, planGates } from './pipeline-plan.mjs';
import { dependencyChangedBetween } from './dependency-change.mjs';

const DOC = /^(AGENTS\.md|README\.md|docs\/|\.lane-claims\/|\.mailmap$)/;
const CI = /^(\.github\/|scripts\/)/;
// Nur echte Toolchain-Aenderungen; `package.json` entscheidet der Inhaltsdiff
// (`dependencyChangedBetween`), damit der Turn-Versionsbump kein Vollprofil ausloest.
const DEPS = /^src\/Config\/(tsconfig\.json|vite\.config\.ts|eslint\.config\.mjs|capacitor\.config\.json)$/;
const PRODUCT = /^(src\/|content\/|public\/|index\.html$|capacitor\.config\.json$)/;
const CONTENT = /^(content\/|public\/)/;
// Tests sind kein ausgeliefertes Produkt: sie brauchen die Suite, aber keinen
// Build. Ein reiner Testfix darf keinen Android-Job rechtfertigen.
const TEST_FILE = /((^|\/)__tests__\/|\.(test|spec|bench)\.[cm]?[jt]sx?$)/;

/** Advisory-Nachweise: eigene Workflow-Jobs, nie Teil des Pflichtstatus. */
export const ADVISORY_GATES = Object.freeze(['statistics', 'soak', 'narrative-longrun', 'balance', 'bench']);

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

/**
 * Diff zwischen zwei Staenden. `null` heisst "nicht bestimmbar" und fuehrt
 * bewusst zum vollen Profil, statt eine leere Matrix als gruen zu verkaufen.
 */
export function diffFiles(base, head) {
  if (!base || !head) return null;
  const threeDot = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`]);
  if (threeDot !== null) return threeDot.split(/\r?\n/).filter(Boolean).sort();
  const twoDot = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}..${head}`]);
  if (twoDot !== null) return twoDot.split(/\r?\n/).filter(Boolean).sort();
  return null;
}

/** Grobe Einordnung der geaenderten Pfade. */
export function classifyChanged(changed, range = {}) {
  const files = [...new Set(changed ?? [])];
  const manifest = dependencyChangedBetween(range.base, range.head);
  return {
    files,
    empty: files.length === 0,
    docsOnly: files.length > 0 && files.every((file) => DOC.test(file)),
    deps: manifest || files.some((file) => DEPS.test(file)),
    ci: files.some((file) => CI.test(file)),
    product: files.some((file) => PRODUCT.test(file) && !TEST_FILE.test(file)),
    tests: files.some((file) => TEST_FILE.test(file)),
    content: files.some((file) => CONTENT.test(file) && !TEST_FILE.test(file)),
    unknown: files.filter((file) => !DOC.test(file) && !CI.test(file) && !DEPS.test(file) && !PRODUCT.test(file) && !/^(package\.json|pnpm-lock\.yaml)$/.test(file)),
  };
}

/**
 * Gate-Auswahl. `full`/`release` bleiben vollstaendig; nur der PR-Pfad
 * (`impact: true`) darf verengen. Jede Verengung ist begruendet.
 */
export function selectGates(changed, options = {}) {
  const kind = classifyChanged(changed, options);
  const profile = options.profile ?? 'full';
  const impact = options.impact === true;

  // `release` bleibt absichtlich vollstaendig; `full` darf bei aktivem Impact
  // verengen, sonst waere die Matrix weiter nur ein Profil-Alias.
  if (!impact || profile === 'release') {
    return { kind, gates: planGates(profile) ?? planGates('full'), reason: `Profil ${profile}`, skipped: [] };
  }
  if (kind.empty || kind.deps || kind.unknown.length > 0) {
    const reason = kind.empty
      ? 'kein Diff bestimmbar: konservativ volles Profil'
      : kind.deps
        ? 'Dependencies, Lockfile oder Toolchain: volles Profil'
        : `unbekannte Pfade (${kind.unknown.slice(0, 3).join(', ')}): konservativ volles Profil`;
    return { kind, gates: planGates('full'), reason, skipped: [] };
  }
  if (kind.docsOnly) {
    const gates = ['check:loc', 'docs', 'tree', 'redundancy'];
    return {
      kind,
      gates,
      reason: 'nur Doku oder Governance',
      skipped: ['lint', 'typecheck', 'test-quality', 'dead-code', 'tests', 'assets', 'capabilities', 'build', 'audit']
        .map((gate) => ({ gate, reason: 'von Doku nicht beruehrt' })),
    };
  }

  const selected = new Set(['lint', 'check:loc', 'typecheck', 'docs', 'tree', 'redundancy']);
  if (kind.ci || kind.product || kind.tests) {
    for (const gate of ['test-quality', 'dead-code', 'tests']) selected.add(gate);
  }
  if (kind.ci || kind.product) selected.add('capabilities');
  if (kind.product) selected.add('build');
  if (kind.content) selected.add('assets');
  if (kind.deps) selected.add('audit');

  // Nie ein Gate, das das Profil nicht kennt: `run-pipeline` wuerde sonst
  // abbrechen und die Matrix waere ungueltig.
  const allowed = new Set(planGates(profile) ?? planGates('full'));
  const gates = [...selected].filter((key) => GATES[key] && allowed.has(key));
  const skipped = Object.keys(GATES)
    .filter((key) => !selected.has(key))
    .map((key) => ({
      gate: key,
      reason: key === 'assets'
        ? 'keine Aenderung an content/ oder public/'
        : key === 'build'
          ? 'kein Runtime-Code betroffen'
          : key === 'audit'
            ? 'keine Dependency-Aenderung'
            : 'nicht betroffen',
    }));
  const reason = [
    kind.product ? 'Runtime' : null,
    kind.ci ? 'CI/Governance' : null,
    kind.content ? 'Content/Assets' : null,
  ].filter(Boolean).join(' + ') || 'Impact';
  return { kind, gates, reason, skipped };
}

/**
 * Testauswahl fuer den `tests`-Job. Volles Profil laesst `files` leer, damit
 * die Suite vollstaendig laeuft; der Impact-Pfad uebergibt genau die
 * betroffenen schnellen Nachweise als `RBD_TEST_FILES`.
 */
export function selectTests(changed, options = {}) {
  const profile = options.profile ?? 'full';
  const impact = options.impact === true;
  if (!impact || profile === 'release') {
    return { files: [], runAll: true, reason: `vollstaendiges Profil ${profile}`, shards: [] };
  }
  const selection = selectAffectedTests(changed ?? []);
  const split = partitionByProof(selection.tests ?? []);
  const files = [...new Set(split.fast ?? [])].sort();
  const long = [...new Set((split.long ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.file)))].sort();
  const shardCount = files.length > 12 ? Math.min(3, Math.ceil(files.length / 8)) : 0;
  const shards = shardCount > 0
    ? Array.from({ length: shardCount }, (_, index) => ({
      shard: index,
      files: files.filter((_, position) => position % shardCount === index),
    }))
    : [];
  return { files, long, runAll: selection.runAll === true, reason: selection.reason ?? 'Impact-Auswahl', shards };
}

/** Ein Plan aus bereits bekannten Aenderungen. */
export function buildPlan(changed, options = {}) {
  const gates = selectGates(changed, options);
  const tests = selectTests(changed, options);
  return {
    changed: gates.kind.files,
    gates: gates.gates.map((key) => ({ gate: GATES[key].name })),
    gateKeys: gates.gates,
    reason: gates.reason,
    skipped: gates.skipped,
    tests,
    advisory: [...ADVISORY_GATES],
    required: gates.gates,
  };
}

/** Plan direkt aus zwei Git-Staenden; `null` bei nicht bestimmbarem Diff. */
export function planForCI(options = {}) {
  const changed = options.changed ?? diffFiles(options.base, options.head);
  if (changed === null) return null;
  return { changed, plan: buildPlan(changed, options) };
}

/** Kleine, dauerhafte Zusammenfassung fuer Artefakt und Telemetrie. */
export function planReport(changed, plan) {
  return {
    changed,
    systems: [...new Set(changed.map((file) => file.split('/').slice(0, 2).join('/')))].slice(0, 12),
    reason: plan.reason,
    gates: plan.gateKeys,
    skipped: plan.skipped,
    tests: { count: plan.tests.files.length, runAll: plan.tests.runAll, reason: plan.tests.reason, shards: plan.tests.shards.length },
    long: plan.tests.long ?? [],
    advisory: plan.advisory,
    required: plan.required,
  };
}
