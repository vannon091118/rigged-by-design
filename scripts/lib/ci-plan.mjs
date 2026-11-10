/**
 * CI-Plan: der Event-Zustand entscheidet, welche Gates und Tests laufen.
 *
 * Die Analyse selbst liegt in `affected-tests.mjs` (Importgraph, Testziele),
 * `test-catalog.mjs` (Beweisklassen), `dependency-change.mjs` (Audit) und
 * `pipeline-plan.mjs` (Gate-Liste). Dieses Modul fuehrt sie zusammen; es
 * erfindet keine Metadaten und keine zweite Impact-Wahrheit.
 *
 * Grundsaetze:
 * - PR, MAIN und MANUAL tragen das zentrale Required-Set und die volle Suite.
 * - LIGHT, NOOP und PR_HANDOFF brauchen weder Tests noch Long-Tests.
 * - Impact ergaenzt nur Audit und die betroffenen Long-Tests, nie eine
 *   verkuerzte schnelle Regression.
 * - Unbekannter oder nicht bestimmbarer Diff -> volles Profil (fail-closed).
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './report.mjs';
import { selectAffectedTests } from './affected-tests.mjs';
import { partitionByProof } from './test-catalog.mjs';
import {
  CI_STATES,
  GATES,
  REQUIRED_CI_GATES,
  gatesForState,
  isCIState,
  planGates,
} from './pipeline-plan.mjs';
import { dependencyChangedBetween } from './dependency-change.mjs';

const DOC = /^(AGENTS\.md|README\.md|docs\/|\.lane-claims\/|\.mailmap$)/;
const CI = /^(\\.github\/|scripts\/)/;
// Nur echte Toolchain-Aenderungen; `package.json` entscheidet der Inhaltsdiff
// (`dependencyChangedBetween`), damit der Turn-Versionsbump kein Vollprofil ausloest.
const DEPS = /^src\/Config\/(tsconfig\.json|vite\.config\.ts|eslint\.config\.mjs|capacitor\.config\.json)$/;
const PRODUCT = /^(src\/|content\/|public\/|index\.html$|capacitor\.config\.json$)/;
const CONTENT = /^(content\/|public\/)/;
// Tests sind kein ausgeliefertes Produkt: sie brauchen die Suite, aber keinen
// Build. Ein reiner Testfix darf keinen Android-Job rechtfertigen.
const TEST_FILE = /((^|\/)__tests__\/|\\.(test|spec|bench)\\.[cm]?[jt]sx?$)/;

/** Advisory-Nachweise: eigene Workflow-Jobs, nie Teil der Gate-Matrix. */
export const ADVISORY_GATES = Object.freeze(['balance', 'bench']);

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
  // Ohne expliziten Vergleichsbereich ist der Manifest-Diff nicht lesbar;
  // dann entscheidet die Pfadliste. `planForCI` uebergibt base/head immer dann,
  // wenn es einen echten Git-Diff prueft; dort bleibt ein Lesefehler fail-closed.
  const manifest = range.base && range.head ? dependencyChangedBetween(range.base, range.head) : false;
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

const stateName = (value) => {
  const state = String(value ?? '').toUpperCase();
  return isCIState(state) ? state : null;
};

/**
 * Der Zustand ist die eine Entscheidung, aus der Gates, Tests und Aggregate
 * abgeleitet werden. `NOOP` ist ein ausdruecklicher No-op, `UNKNOWN` der
 * konservative Volllauf; beide werden nie stillschweigend zu LIGHT.
 */
export function stateFor(options = {}) {
  const explicit = stateName(options.state);
  if (explicit) return explicit;
  if (options.noop === true) return 'NOOP';
  if (options.handoff === true) return 'PR_HANDOFF';

  const event = String(options.event ?? '').toLowerCase();
  const ref = String(options.ref ?? options.branch ?? '');
  const main = options.main === true || ref === 'main' || ref === 'refs/heads/main';
  const changed = Array.isArray(options.changed) ? options.changed : null;

  if (event === 'workflow_dispatch' || event === 'manual') return 'MANUAL';
  if (event === 'pull_request' || event === 'pr') {
    return changed && changed.length === 0 ? 'NOOP' : 'PR';
  }
  if (event === 'push' || event === 'push-main') {
    if (!main) return 'LIGHT';
    return changed && changed.length === 0 ? 'NOOP' : 'MAIN';
  }
  // Ohne belastbares Event bleibt es beim vollen Profil, nie bei einer leeren
  // oder nur scheinbar leichten Matrix.
  return 'UNKNOWN';
}

export { CI_STATES, REQUIRED_CI_GATES };

const stateReason = (state) => ({
  PR: 'PR: Required-Set und vollstaendige Suite',
  MAIN: 'main: Required-Set und vollstaendige Suite',
  MANUAL: 'manuell: Required-Set, Suite und Audit',
  LIGHT: 'Feature-Push: Light-Gates ohne Suite',
  NOOP: 'No-op: keine Gates, keine Tests',
  PR_HANDOFF: 'PR-Handoff: der PR-Lauf prueft',
  UNKNOWN: 'unbekannter Zustand: volles Profil',
}[state] ?? `Zustand ${state}`);

/** Ein explizit gepinntes Required-Set; leer heisst "nicht gepinnt". */
const pinnedRequired = (options) =>
  Array.isArray(options.required) && options.required.length > 0 ? [...options.required] : null;

/**
 * Gate-Auswahl. Die Required-Liste ist die Untergrenze; Impact darf nur Audit
 * ergaenzen. Ein Zustand ohne Gates liefert bewusst eine leere Matrix - auch
 * dann, wenn ein Required-Set gepinnt wurde: ein No-op verlangt nichts.
 */
export function selectGates(changed, options = {}) {
  const files = [...(changed ?? [])];
  const state = stateFor({ ...options, changed: files });
  const kind = classifyChanged(files, options);
  const stateGates = gatesForState(state) ?? planGates('full');
  if (stateGates.length === 0) {
    return {
      kind,
      state,
      gates: [],
      required: [],
      reason: stateReason(state),
      skipped: Object.keys(GATES).map((gate) => ({ gate, reason: 'Zustand ohne Gate-Lauf' })),
    };
  }

  const required = pinnedRequired(options) ?? stateGates;
  const selected = new Set(required);
  if (state === 'MANUAL') selected.add('audit');
  if ((state === 'PR' || state === 'MAIN') && options.impact === true && kind.deps) selected.add('audit');

  const gates = [...selected].filter((key) => GATES[key] && (required.includes(key) || key === 'audit'));
  const skipped = Object.keys(GATES)
    .filter((key) => !gates.includes(key))
    .map((key) => ({
      gate: key,
      reason: key === 'audit'
        ? 'keine Dependency-Aenderung'
        : key === 'build' && state === 'LIGHT'
          ? 'kein Build im Light-Zustand'
          : 'im Zustand nicht vorgesehen',
    }));
  return {
    kind,
    state,
    gates,
    required: [...required],
    reason: stateReason(state),
    skipped,
  };
}

/**
 * Testauswahl: PR, MAIN und MANUAL fahren die vollstaendige Suite. LIGHT,
 * NOOP und PR_HANDOFF fahren nie Tests; ein Zustand ohne `tests`-Gate darf
 * niemals `runAll: true` melden. Der Impact waehlt nur die langen Nachweise.
 */
export function selectTests(changed, options = {}) {
  const files = [...(changed ?? [])];
  const state = stateFor({ ...options, changed: files });
  const required = pinnedRequired(options) ?? gatesForState(state) ?? [];
  if (!required.includes('tests')) {
    return { files: [], long: [], runAll: false, reason: `${state}: kein tests-Gate`, shards: [] };
  }

  const selection = selectAffectedTests(files);
  const split = partitionByProof(selection.tests ?? []);
  const long = [...new Set((split.long ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.file)))].sort();
  const fullSuite = ['PR', 'MAIN', 'MANUAL', 'UNKNOWN'].includes(state);
  if (!fullSuite) {
    return { files: [], long: [], runAll: false, reason: `${state}: keine Tests`, shards: [] };
  }
  return {
    files: [],
    long,
    runAll: true,
    reason: `vollstaendige Suite (${state})`,
    shards: [],
  };
}

/** Ein Plan aus bereits bekannten Aenderungen. */
export function buildPlan(changed, options = {}) {
  const gates = selectGates(changed, options);
  const tests = selectTests(changed, { ...options, state: gates.state });
  return {
    changed: gates.kind.files,
    state: gates.state,
    base: String(options.base ?? ''),
    head: String(options.head ?? ''),
    runId: String(options.runId ?? ''),
    gates: gates.gates.map((key) => ({ gate: GATES[key].name })),
    gateKeys: gates.gates,
    reason: gates.reason,
    skipped: gates.skipped,
    tests,
    advisory: [...ADVISORY_GATES],
    required: gates.required,
    run: gates.gates.length > 0,
    noop: gates.state === 'NOOP',
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
    state: plan.state,
    base: plan.base ?? '',
    head: plan.head ?? '',
    runId: plan.runId ?? '',
    run: plan.run,
    noop: plan.noop,
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
