/** Deklarationen fuer den Pre-Push-Claim-Audit. */
declare module '*/claim-preflight.mjs' {
  export interface StatusEntry {
    readonly code: string;
    readonly path: string;
    readonly untracked: boolean;
  }
  export interface ClaimView {
    readonly id: string;
    readonly branch: string;
    readonly owner: string;
    readonly issue?: number | null;
    readonly status: string;
    readonly task?: string;
    readonly pathAllowlist?: readonly string[];
  }
  export interface TaskContractView {
    readonly claimId: string;
    readonly phase: string;
    readonly findings?: readonly {
      readonly status: string;
      readonly severity: string;
    }[];
  }
  export interface TaskEntry {
    readonly file: string;
    readonly contract: TaskContractView;
  }
  export interface PreflightResult {
    readonly branch: string;
    readonly skipped: boolean;
    readonly current: ClaimView | null;
    readonly currentTask: TaskContractView | null;
    readonly open: readonly ClaimView[];
    readonly parallel: readonly ClaimView[];
    readonly wip: readonly StatusEntry[];
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
  }
  export function parseStatusLines(lines?: readonly string[] | string): StatusEntry[];
  export function inspectClaimPreflight(input?: {
    readonly branch?: string;
    readonly claims?: readonly ClaimView[];
    readonly tasks?: readonly TaskEntry[];
    readonly status?: readonly string[] | string;
    readonly taskErrors?: readonly string[];
  }): PreflightResult;
  export function formatClaimPreflight(result: PreflightResult): string;
}
