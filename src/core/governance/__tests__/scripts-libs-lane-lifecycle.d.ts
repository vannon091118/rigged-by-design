/** Deklarationen fuer Lane-Claims, Staging-Scope, Isolation, Takeover und Lifecycle. */
declare module '*/branch-prune.mjs' {
  export const PROTECTED: readonly string[];
  export interface BranchState { readonly name: string; readonly upstreamGone: boolean; readonly merged?: boolean; }
  export function parseBranches(text: string): BranchState[];
  export function prunable(
    branches: readonly BranchState[],
    options?: { protected?: readonly string[]; current?: string },
  ): string[];
}
declare module '*/lane-claims.mjs' {
  export interface ClaimLike {
    readonly id: string;
    readonly branch: string;
    readonly status: string;
  }
  export function selectClaim(claims: readonly ClaimLike[], branch: string): ClaimLike | null;
  export function claimForBranch(branch: string): ClaimLike | null;
  export interface ClaimRecord {
    readonly id: string; readonly branch: string; readonly owner?: string; readonly status: string;
    readonly pathAllowlist?: readonly string[]; readonly contracts?: readonly { readonly id: string; readonly mode: string }[];
    readonly dependencies?: readonly string[]; readonly gateProfile?: string; readonly baseSha?: string;
    readonly task?: string; readonly goal?: string;
    readonly mergedEvidence?: string | null; readonly mergedSha?: string | null;
  }
  export interface ClaimAudit { readonly ok: boolean; readonly violations: readonly string[] }
  export const CONTROL_PLANE: readonly string[];
  export const META_FILES: readonly string[];
  export const MECHANICAL_FILES: readonly string[];
  export const GOVERNANCE_ONLY_FILES: readonly string[];
  export function isControlPlanePattern(pattern: string): boolean;
  export function isGovernanceLane(id: string): boolean;
  export function patternCoveredBy(pattern: string, allowlist: readonly string[]): boolean;
  export function patternPrefix(pattern: string): string;
  export function patternsOverlap(a: string, b: string): boolean;
  export function findCollisions(newClaim: ClaimRecord, candidates?: readonly ClaimRecord[]): readonly { readonly lane: string; readonly reason: string; readonly contractConflict: readonly string[] }[];
  export function validateNewClaim(claim: ClaimRecord, options?: { readonly legacy?: boolean }): ClaimAudit;
  export function auditClaimChange(previous: ClaimRecord | null, next: ClaimRecord | null): ClaimAudit;
  export function auditRegisterAgainstBase(input: { readonly baseClaims?: readonly ClaimRecord[]; readonly registrationClaims?: readonly ClaimRecord[]; readonly nextClaims?: readonly ClaimRecord[]; readonly branch?: string }): ClaimAudit;
}
declare module '*/staging-scope.mjs' {
  export const TURN_EXEMPT: readonly string[];
  export function scopeChanges(input: {
    readonly changed: readonly string[];
    readonly allowlist: readonly string[];
    readonly exempt?: readonly string[];
    readonly claims?: readonly {
      readonly id?: string;
      readonly branch: string;
      readonly status: string;
      readonly pathAllowlist?: readonly string[];
    }[];
    readonly branch?: string;
    readonly freezeUnlocked?: boolean;
  }): {
    allowed: string[];
    foreign: string[];
    ok: boolean;
    takeover: {
      readonly total: number;
      readonly adopted: number;
      readonly blocked: number;
      readonly counts: Readonly<Record<'compatible' | 'incomplete' | 'corrupted', number>>;
      readonly corrupted: readonly { readonly path: string; readonly reason: string }[];
    };
  };
  export function explicitScope(input: {
    readonly paths: readonly string[];
    readonly allowlist: readonly string[];
    readonly exempt?: readonly string[];
  }): { allowed: string[]; foreign: string[]; ok: boolean };
}
declare module '*/worktree-isolation.mjs' {
  export const ISOLATION_CODE: string;
  export function isLinkedWorktree(gitDir: string, commonDir: string): boolean;
  export function parseStatusPaths(text: string): string[];
  export function isolationRequired(input?: { readonly explicit?: boolean }): boolean;
  export function foreignClaimPaths(input?: { readonly changed?: readonly string[]; readonly claims?: readonly { readonly branch: string; readonly status: string; readonly pathAllowlist?: readonly string[] }[]; readonly branch?: string }): string[];
  export function assessIsolation(input?: { readonly required?: boolean; readonly isWorktree?: boolean; readonly dirtyPaths?: readonly string[]; readonly foreignPaths?: readonly string[]; readonly branch?: string }): { readonly code: string; readonly ok: boolean; readonly required: boolean; readonly isWorktree: boolean; readonly branch: string; readonly dirtyPaths: readonly string[]; readonly foreignPaths: readonly string[]; readonly reasons: readonly string[] };
}
declare module '*/takeover.mjs' {
  export type WipKind = 'compatible' | 'incomplete' | 'corrupted';
  export interface WipEntry {
    readonly path: string;
    readonly kind: WipKind;
    readonly adopt: true;
    readonly reason: string;
    readonly source: string | null;
  }
  export interface TakeoverSummary {
    readonly total: number;
    readonly adopted: number;
    readonly blocked: number;
    readonly counts: Readonly<Record<WipKind, number>>;
    readonly corrupted: readonly { readonly path: string; readonly reason: string }[];
  }
  export const WIP_KINDS: readonly WipKind[];
  export const TAKEOVER_CODE: string;
  export function isCriticalPath(file: string): boolean;
  export function classifyWip(input?: {
    readonly path?: string;
    readonly claims?: readonly {
      readonly id?: string;
      readonly branch: string;
      readonly status: string;
      readonly pathAllowlist?: readonly string[];
    }[];
    readonly branch?: string;
    readonly allowlist?: readonly string[];
    readonly freezeUnlocked?: boolean;
  }): WipEntry | null;
  export function summarizeTakeover(entries?: readonly (WipEntry | null)[]): TakeoverSummary;
}
declare module '*/branch-lifecycle.mjs' {
  export interface WorktreeEntry {
    readonly path: string;
    readonly branch: string | null;
    readonly head: string | null;
    readonly prunable: boolean;
  }
  export interface BranchEntry {
    readonly name: string;
    readonly merged?: boolean;
  }
  export const PROTECTED_BRANCHES: readonly string[];
  export function parseWorktrees(text: string): WorktreeEntry[];
  export function planCleanup(input?: {
    readonly branches?: readonly (BranchEntry | string)[];
    readonly worktrees?: readonly WorktreeEntry[];
    readonly current?: string;
    readonly protected?: readonly string[];
  }): {
    readonly delete: readonly string[];
    readonly keep: readonly { readonly name: string; readonly reason: string }[];
    readonly prune: readonly string[];
  };
}
