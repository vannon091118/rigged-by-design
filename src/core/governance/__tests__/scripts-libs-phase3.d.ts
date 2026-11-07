/** Deklarationen fuer Scope- und Reparaturplan (Phase 3). */
declare module '*/issue-scope.mjs' {
  export interface IssueScope {
    readonly kind: 'main' | 'lane' | 'dependency' | 'none';
    readonly lane: string | null;
  }
  export interface IssueDecision {
    readonly scope: IssueScope;
    readonly repairSha: string | null;
    readonly disposition: 'blocker' | 'warning';
    readonly reason: string;
  }
  export interface IssueBodyInput {
    readonly branch?: string;
    readonly headSha?: string;
    readonly gate?: string | null;
    readonly code?: string;
    readonly fingerprint: string;
    readonly state?: string | null;
    readonly runUrl?: string;
    readonly report?: string;
    readonly repair?: string | null;
    readonly autofix?: string | null;
  }
  export const SCOPE_MAIN: string;
  export const FINGERPRINT_MARKER: RegExp;
  export const REPAIR_MARKER: RegExp;
  export const AUTOFIX_MARKER: RegExp;
  export function labelNames(issue: unknown): string[];
  export function scopeLabel(branch: string): string | null;
  export function scopeOf(issue: unknown): IssueScope;
  export function laneMatches(scopeLane: string, target: string): boolean;
  export function parseIssueBody(body: string): {
    branch: string | null;
    headSha: string | null;
    gate: string | null;
    code: string | null;
    fingerprint: string | null;
    repair: string | null;
    autofix: string | null;
  };
  export function classifyIssue(
    issue: unknown,
    options?: {
      branch?: string;
      dependencies?: readonly string[];
      isAncestor?: (sha: string) => boolean;
    },
  ): IssueDecision;
  export function fingerprintOf(code: string, line: string): string;
  export function issueBody(input: IssueBodyInput): string;
}

declare module '*/repair-plan.mjs' {
  export interface Resolution {
    readonly action: 'none' | 'rerun' | 'repair' | 'issue';
    readonly reason: string;
    readonly state: string | null;
    readonly marker: string | null;
    readonly gates: readonly string[];
    readonly paths: readonly string[];
  }
  export const AUTOFIX_MAX_ATTEMPTS: number;
  export const AUTOFIX_SCRIPTS: readonly string[];
  export const MECHANICAL_PATHS: readonly string[];
  export const MECHANICAL_CODES: readonly string[];
  export function isMechanicalPath(path: string): boolean;
  export function filterPaths(paths: readonly string[]): {
    allowed: string[];
    foreign: string[];
    ok: boolean;
  };
  export function requestedPaths(failures: readonly { code?: string }[]): string[];
  export function gateOf(failure: { step?: string | null; gate?: string | null }): string | null;
  export function affectedGates(
    failures: readonly { code?: string; level?: string; step?: string | null; gate?: string | null }[],
  ): string[];
  export function autofixMarker(sha: string): string;
  export function hasAutofixMarker(body: string, sha: string): boolean;
  export function repairAttemptAllowed(input?: {
    body?: string;
    sha?: string;
    attempts?: number;
  }): boolean;
  export function planResolution(input?: {
    state?: string | null;
    conclusion?: string;
    failures?: readonly { code?: string; level?: string; step?: string | null; gate?: string | null }[];
    branch?: string;
    sameRepo?: boolean;
    fork?: boolean;
    body?: string;
    sha?: string;
    attempts?: number;
  }): Resolution;
}

declare module '*/auto-resolve.mjs' {
  export function changedPaths(text: string): string[];
  export function patchPath(sha: string): string;
  export function attemptRepair(input?: {
    branch?: string;
    sha?: string;
    gates?: readonly string[];
    marker?: string;
    controlRoot?: string;
    repo?: string;
    token?: string;
    worktree?: string;
    git?: (args: string[], options?: Record<string, unknown>) => string;
    exec?: (command: string, args: string[], options?: Record<string, unknown>) => string;
    log?: (message: string) => void;
  }): { ok: boolean; pushed?: boolean; paths?: string[]; sha?: string; patch?: string; reason?: string };
}
