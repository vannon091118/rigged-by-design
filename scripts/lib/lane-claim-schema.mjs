/**
 * Claim-Schema: Pfade, Roster, Meta-Dateien, Bot-Ausnahme und Pfadregeln.
 * Keine Datei-Ein-/Ausgabe; das Register liegt in `lane-claim-registry.mjs`.
 */
import { patternPrefix } from './claim-collisions.mjs';
import { CORE_PATHS } from './doc-core.mjs';

export const CLAIM_ENTRY_PREFIX = '.lane-claims/claims/';
export const SHARED_DOC_FILES = Object.freeze([
  'docs/governance/LAST-CHANGES.md',
  // Generiert aus package.json; jede Dependency-Lane schreibt dieselbe Zeile.
  'docs/DEPENDENCY-MATRIX.md',
  // Legacy-Pfade der Doku-Migration: Loeschung/Umzug ist Koordination, keine Kollision.
  'docs/INDEX.md',
  'docs/LAST-CHANGES.md',
]);
const CORE_CONTENT_DOCS = Object.freeze(
  CORE_PATHS.filter((path) => !SHARED_DOC_FILES.includes(path)),
);

export function isClaimTooling(file) {
  const path = String(file ?? '').replaceAll('\\', '/');
  return path.startsWith(CLAIM_ENTRY_PREFIX) || isTaskContractPath(path);
}

export const COORDINATION_FILES = Object.freeze([
  '.lane-claims',
  '.lane-claims/claims.json',
  ...SHARED_DOC_FILES,
]);

export const TASK_CONTRACT_PREFIX = '.lane-claims/tasks/';

export function isTaskContractPath(file) {
  return String(file ?? '').replaceAll('\\', '/').startsWith(TASK_CONTRACT_PREFIX);
}

export const OWNERS = Object.freeze([
  'Integrator',
  'Governance-Owner',
  'Architektur-Owner',
  'Ledger-/Core-Owner',
  'Quality-/Capability-Owner',
  'Interaction-Contract-Owner',
  'Sim-/Domain-Owner',
  'Save-/Migrations-Owner',
  'Monitor',
]);

export const META_FILES = Object.freeze([
  ...CORE_CONTENT_DOCS,
  'docs/INVENTORY.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVTAGEBUCH.md',
  'package.json',
  'pnpm-lock.yaml',
]);

export const MECHANICAL_FILES = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'docs/INVENTORY.md',
  'docs/governance/ROADMAP.md',
  'docs/DEPENDENCY-MATRIX.md',
]);

export const GOVERNANCE_ONLY_FILES = Object.freeze([
  ...CORE_CONTENT_DOCS,
  'docs/ARCHITECTURE.md',
]);

export function isForbiddenForLanes(filePath) {
  return META_FILES.includes(String(filePath ?? '').replaceAll('\\', '/'));
}

/** Exakter Pfad, Verzeichnis mit `/` oder rekursiv mit `/**`. */
export function allowsPath(allowlist, filePath) {
  const normalized = String(filePath ?? '').replaceAll('\\', '/');
  return allowlist.some((pattern) => {
    const clean = String(pattern ?? '').replaceAll('\\', '/');
    if (clean.endsWith('/**')) {
      const prefix = clean.slice(0, -3);
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }
    if (clean.endsWith('/')) return normalized.startsWith(clean);
    return normalized === clean;
  });
}

export const BRANCH_PATTERN = /^lane\/[a-z0-9-]+\/[a-z0-9-]+$/;
export const LEGACY_PREFIXES = Object.freeze(['gov/', 'hygiene/', 'fix/']);

export const BOT_BRANCHES = Object.freeze([
  { pattern: /^dependabot\//, allowlist: Object.freeze(['package.json', 'pnpm-lock.yaml', '.github/workflows/']) },
]);

export function botAllowlist(branch) {
  return BOT_BRANCHES.find((entry) => entry.pattern.test(String(branch ?? '')))?.allowlist ?? null;
}

export const CONTROL_PLANE = Object.freeze(['.github', 'scripts', 'src/Config']);
export const isGovernanceLane = (id) => /^(?:lane\/(?:governance|ci)\/|gov\/)/.test(String(id ?? ''));
export const CONTROL_PLANE_LANE = /^(?:lane\/(?:governance|ci)\/|gov\/)/;

export function isControlPlanePattern(pattern) {
  const prefix = patternPrefix(pattern);
  return CONTROL_PLANE.some((area) => prefix === area || prefix.startsWith(`${area}/`));
}

/** True, wenn ein Muster vollstaendig von der Allowlist gedeckt ist. */
export function patternCoveredBy(pattern, allowlist) {
  const prefix = patternPrefix(pattern);
  return allowlist.some((entry) => {
    const base = patternPrefix(entry);
    return base === prefix || prefix.startsWith(`${base}/`);
  });
}
