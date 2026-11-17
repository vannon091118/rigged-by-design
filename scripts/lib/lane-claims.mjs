/**
 * Lane-Claims: Claim-, Konflikt- und Gate-Validierung für parallele Agenten-Arbeit.
 *
 * Jede Lane hat eine ID, einen Owner, einen Branch, einen Basis-SHA, eine
 * Pfad-Allowlist und optionale Contract-Writer-Claims. Gleichzeitig darf genau
 * ein Writer pro Contract-ID existieren. Read-only Konsumenten dürfen parallel
 * sein. Das Register wird unter `.lane-claims` geführt.
 */
import { patternPrefix, patternsOverlap } from './claim-collisions.mjs';
import { loadClaims } from './lane-claim-registry.mjs';
import { findCollisions } from './lane-claim-audit.mjs';

export { patternPrefix, patternsOverlap };
export {
  BOT_BRANCHES, BRANCH_PATTERN, CLAIM_ENTRY_PREFIX, CONTROL_PLANE, COORDINATION_FILES,
  GOVERNANCE_ONLY_FILES, LEGACY_PREFIXES, MECHANICAL_FILES, META_FILES, OWNERS,
  SHARED_DOC_FILES, TASK_CONTRACT_PREFIX, allowsPath, botAllowlist, isClaimTooling,
  isControlPlanePattern, isForbiddenForLanes, isGovernanceLane, isTaskContractPath,
  patternCoveredBy,
} from './lane-claim-schema.mjs';
export { LaneClaim, botClaim } from './lane-claim.mjs';
export {
  claimForBranch, loadClaims, loadClaimsStrict, openClaims, pathAllowedForClaim,
  removeClaim, saveClaims, selectClaim, upsertClaim,
} from './lane-claim-registry.mjs';
export {
  auditClaimChange, auditRegisterAgainstBase, auditTaskClaimParity,
  contractWriterConflicts, findCollisions, validateNewClaim,
} from './lane-claim-audit.mjs';

/** Gibt eine maschinenlesbare Zusammenfassung für agent:context. */
export function contextSummary() {
  const all = loadClaims();
  const claims = all.filter((c) => c.status === 'open');
  const parked = all.filter((c) => c.status === 'parked');
  const merged = all.filter((c) => c.status === 'merged');

  const allCollisions = [];
  for (const claim of claims) {
    const collisions = findCollisions(claim, claims);
    if (collisions.length > 0) {
      allCollisions.push({ lane: claim.id, collisions });
    }
  }

  return {
    open: claims.map((c) => ({
      id: c.id,
      owner: c.owner,
      branch: c.branch,
      baseSha: c.baseSha,
      issue: c.issue ?? null,
      task: c.task ?? '',
      goal: c.goal ?? '',
      pathAllowlist: c.pathAllowlist,
      writeContracts: c.writeContracts(),
      dependencies: c.dependencies,
      gateProfile: c.gateProfile,
    })),
    parked: parked.map((c) => ({ id: c.id, owner: c.owner, reason: 'PARKED in ROADMAP.md' })),
    merged: merged.map((c) => ({ id: c.id, branch: c.branch })),
    collisions: allCollisions,
  };
}
