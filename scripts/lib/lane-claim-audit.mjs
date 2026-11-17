/**
 * Claim-Audits: Kollisionen, neue Claims, Aenderungen gegen die Basis und
 * Paritaet zum Task-Vertrag. Liest das Register, schreibt nie.
 */
import { findClaimCollisions } from './claim-collisions.mjs';
import {
  BRANCH_PATTERN, CLAIM_ENTRY_PREFIX, CONTROL_PLANE_LANE, COORDINATION_FILES,
  GOVERNANCE_ONLY_FILES, LEGACY_PREFIXES, MECHANICAL_FILES, META_FILES, OWNERS,
  allowsPath, isControlPlanePattern, isGovernanceLane, patternCoveredBy,
} from './lane-claim-schema.mjs';
import { openClaims, selectClaim } from './lane-claim-registry.mjs';

export function findCollisions(newClaim, candidates = openClaims()) {
  return findClaimCollisions({
    newClaim,
    candidates,
    metaFiles: META_FILES,
    mechanicalFiles: MECHANICAL_FILES,
    coordinationFiles: COORDINATION_FILES,
    claimEntryPrefix: CLAIM_ENTRY_PREFIX,
  });
}

export function contractWriterConflicts(contractId) {
  const claims = openClaims();
  const writers = claims.filter((c) => c.writeContracts().includes(contractId));
  return writers.length > 1 ? writers : null;
}

/** Prueft einen neu registrierten Claim; `legacy` laesst Bestand unangetastet. */
export function validateNewClaim(claim, { legacy = false } = {}) {
  const violations = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    return { ok: false, violations: ['Claim ist kein Objekt'] };
  }
  const label = String(claim.id ?? '(ohne id)');
  if (!String(claim.id ?? '').trim()) violations.push('Claim-ID fehlt');
  if (!OWNERS.includes(claim.owner)) violations.push(`${label}: Owner '${claim.owner ?? ''}' ist nicht im Roster`);
  if (!claim.branch || (!BRANCH_PATTERN.test(claim.branch) && !LEGACY_PREFIXES.some((prefix) => claim.branch.startsWith(prefix)))) {
    violations.push(`${label}: Branch '${claim.branch ?? ''}' folgt nicht dem Schema`);
  }
  if (!legacy && !/^[0-9a-f]{40}$/.test(String(claim.baseSha ?? ''))) {
    violations.push(`${label}: baseSha ist kein vollstaendiger Commit`);
  } else if (legacy && !/^[0-9a-f]{7,40}$/.test(String(claim.baseSha ?? ''))) {
    violations.push(`${label}: baseSha ist kein Commit`);
  }
  const allowlist = Array.isArray(claim.pathAllowlist) ? claim.pathAllowlist : [];
  if (allowlist.length === 0) violations.push(`${label}: Pfad-Allowlist ist leer`);
  const needsIssue = !legacy && claim.status === 'open';
  if (claim.issue === undefined || claim.issue === null) {
    if (needsIssue) violations.push(`${label}: issue fehlt; jede neue offene Lane braucht eine positive Issue-Nummer`);
  } else {
    const issue = Number(claim.issue);
    if (!Number.isInteger(issue) || issue <= 0) violations.push(`${label}: issue '${claim.issue}' ist keine Issue-Nummer`);
  }
  if (!['light', 'quick', 'full'].includes(claim.gateProfile)) violations.push(`${label}: gateProfile '${claim.gateProfile ?? ''}' ist unbekannt`);
  if (!legacy) {
    if (!String(claim.task ?? '').trim()) violations.push(`${label}: task fehlt`);
    if (claim.goal !== undefined && typeof claim.goal !== 'string') violations.push(`${label}: goal ist kein Text`);
    if (!isGovernanceLane(claim.id)) {
      if (allowlist.some(isControlPlanePattern)) {
        violations.push(`${label}: Kontrollebene (.github/, scripts/, src/Config/) nur fuer Governance- oder CI-Lanes`);
      }
      const forbidden = new Set([...GOVERNANCE_ONLY_FILES, ...META_FILES.filter((file) => !MECHANICAL_FILES.includes(file))]);
      for (const file of forbidden) {
        if (allowlist.some((pattern) => allowsPath([pattern], file))) {
          violations.push(`${label}: Meta-Datei '${file}' nur fuer Governance-Lanes`);
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Vergleich eines Claims mit seinem Basisstand. */
export function auditClaimChange(previous, next) {
  const violations = [];
  if (!next) return { ok: false, violations: ['Claim fehlt im neuen Register'] };
  const label = next.id;
  if (!previous) return validateNewClaim(next);
  if (previous.owner !== next.owner) violations.push(`${label}: Owner gewechselt (${previous.owner} -> ${next.owner})`);
  if (previous.status === 'open' && previous.branch !== next.branch) {
    violations.push(`${label}: Branch gewechselt (${previous.branch} -> ${next.branch})`);
  }
  if (previous.status === 'merged' && next.status === 'open') {
    violations.push(`${label}: gemergter Claim wieder geoeffnet`);
  }
  for (const pattern of next.pathAllowlist ?? []) {
    if (!patternCoveredBy(pattern, previous.pathAllowlist ?? [])) {
      violations.push(`${label}: Allowlist erweitert (${pattern})`);
    }
  }
  const before = new Set((previous.contracts ?? []).filter((c) => c.mode === 'write').map((c) => c.id));
  for (const contract of next.contracts ?? []) {
    if (contract.mode === 'write' && !before.has(contract.id)) {
      violations.push(`${label}: Contract-Writer '${contract.id}' hinzugefuegt`);
    }
  }
  return { ok: violations.length === 0, violations };
}

const claimFingerprint = (claim) =>
  JSON.stringify({
    owner: claim.owner,
    branch: claim.branch,
    baseSha: claim.baseSha,
    issue: claim.issue ?? null,
    task: claim.task ?? '',
    goal: claim.goal ?? '',
    pathAllowlist: claim.pathAllowlist ?? [],
    contracts: claim.contracts ?? [],
    dependencies: claim.dependencies ?? [],
    gateProfile: claim.gateProfile,
    status: claim.status,
    mergedEvidence: claim.mergedEvidence ?? null,
    mergedSha: claim.mergedSha ?? null,
  });

/** Register gegen den Basisstand pruefen. */
export function auditRegisterAgainstBase({ baseClaims = [], registrationClaims = [], nextClaims = [], branch } = {}) {
  const violations = [];
  const own = selectClaim(nextClaims, branch);
  if (!own) return { ok: true, violations };
  const governance = CONTROL_PLANE_LANE.test(own.id);
  const baseById = new Map(baseClaims.map((claim) => [claim.id, claim]));
  const registrationById = new Map((registrationClaims.length > 0 ? registrationClaims : baseClaims).map((claim) => [claim.id, claim]));

  for (const claim of nextClaims) {
    const before = claim.id === own.id
      ? (registrationById.get(claim.id) ?? baseById.get(claim.id) ?? null)
      : (baseById.get(claim.id) ?? null);
    if (claim.id === own.id) {
      violations.push(...auditClaimChange(before, claim).violations);
      continue;
    }
    if (!before) {
      if (!governance) violations.push(`${claim.id}: neuer fremder Claim in einer Feature-Lane`);
      else violations.push(...validateNewClaim(claim).violations);
      continue;
    }
    violations.push(...auditClaimChange(before, claim).violations);
    if (!governance && claimFingerprint(before) !== claimFingerprint(claim)) {
      violations.push(`${claim.id}: fremder Claim veraendert (nur Governance)`);
    } else if (governance) {
      const statusOnly = {
        ...before,
        status: claim.status,
        mergedEvidence: claim.mergedEvidence,
        mergedSha: claim.mergedSha,
      };
      if (claimFingerprint(statusOnly) !== claimFingerprint(claim)) {
        violations.push(`${claim.id}: Governance darf fremde Claims nur im Status aendern`);
      }
    }
  }

  for (const before of baseClaims) {
    if (!nextClaims.some((claim) => claim.id === before.id) && !governance) {
      violations.push(`${before.id}: Claim aus dem Register entfernt (nur Governance)`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Claim und Task-Vertrag muessen dieselbe Phase behaupten. */
export function auditTaskClaimParity({ claims = [], tasks = [] } = {}) {
  const violations = [];
  const byClaimId = new Map(claims.map((claim) => [claim?.id, claim]));
  for (const task of tasks) {
    const claim = byClaimId.get(task?.claimId);
    if (!claim) continue;
    if (task.phase === 'DONE' && claim.status === 'open') {
      violations.push(`${claim.id}: Claim offen, Vertrag DONE - auf merged/superseded/archived nachziehen`);
    } else if (claim.status === 'merged' && task.phase !== 'DONE') {
      violations.push(`${claim.id}: Claim merged, Vertrag ${task.phase} - auf DONE nachziehen`);
    }
  }
  return { ok: violations.length === 0, violations };
}
