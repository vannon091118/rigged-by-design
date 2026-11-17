/**
 * Ein einzelner Lane-Claim: Identitaet, Allowlist, Contracts und Serialisierung.
 */
import { allowsPath, botAllowlist } from './lane-claim-schema.mjs';

export class LaneClaim {
  constructor({ id, owner, branch, baseSha, task = '', goal = '', issue = null, pathAllowlist = [], contracts = [], dependencies = [], gateProfile = 'quick', status = 'open', mergedEvidence = null, mergedSha = null }) {
    this.id = id;
    this.owner = owner;
    this.branch = branch;
    this.issue = Number.isInteger(issue) && issue > 0 ? issue : null;
    this.baseSha = baseSha;
    this.task = task;
    this.goal = goal;
    this.pathAllowlist = pathAllowlist;
    this.contracts = contracts;
    this.dependencies = dependencies;
    this.gateProfile = gateProfile;
    this.status = status;
    this.mergedEvidence = mergedEvidence;
    this.mergedSha = mergedSha;
    this.createdAt = baseSha;
  }

  allowsPath(filePath) {
    return allowsPath(this.pathAllowlist, filePath);
  }

  writeContracts() {
    return this.contracts.filter((c) => c.mode === 'write').map((c) => c.id);
  }

  toJSON() {
    return {
      id: this.id,
      owner: this.owner,
      branch: this.branch,
      baseSha: this.baseSha,
      ...(this.issue ? { issue: this.issue } : {}),
      ...(this.task ? { task: this.task } : {}),
      ...(this.goal ? { goal: this.goal } : {}),
      pathAllowlist: this.pathAllowlist,
      contracts: this.contracts,
      dependencies: this.dependencies,
      gateProfile: this.gateProfile,
      status: this.status,
      ...(this.mergedEvidence ? { mergedEvidence: this.mergedEvidence } : {}),
      ...(this.mergedSha ? { mergedSha: this.mergedSha } : {}),
      createdAt: this.createdAt,
    };
  }
}

/** Claim-freier Ersatz fuer einen Bot-Branch; `null` fuer normale Lanes. */
export function botClaim(branch) {
  const allowlist = botAllowlist(branch);
  if (!allowlist) return null;
  return new LaneClaim({
    id: 'bot/dependabot',
    owner: 'Integrator',
    branch,
    baseSha: '',
    task: 'Dependabot-Update',
    pathAllowlist: [...allowlist],
    gateProfile: 'light',
    status: 'open',
  });
}
