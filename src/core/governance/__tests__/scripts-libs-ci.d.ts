/** Deklarationen fuer die CI-Diagnose- und Claim-Evidenz-Bibliotheken. */
declare module '*/gate-diagnostics.mjs' {
  export interface GateFailure {
    readonly gate: string;
    readonly step: string | null;
    readonly code: string;
    readonly line: string;
    readonly level: string;
    readonly failedTest: string | null;
    readonly url: string | null;
  }
  export interface GateDiagnosis {
    readonly failures: readonly GateFailure[];
    readonly groups: readonly { code: string; level: string; gates: string[]; lines: string[] }[];
    readonly report: string;
    readonly codes: readonly string[];
    readonly primary: GateFailure;
  }
  export function errorFromLog(text: string): { code: string; line: string; failedTest: string | null } | null;
  export function failuresFromJobs(
    jobs: readonly Record<string, unknown>[],
    logs?: Map<number, string> | Record<number, string>,
  ): GateFailure[];
  export function groupFailures(failures: readonly GateFailure[]): GateDiagnosis['groups'];
  export function diagnose(input?: {
    readonly jobs?: readonly Record<string, unknown>[];
    readonly logs?: Map<number, string> | Record<number, string>;
  }): GateDiagnosis;
}

declare module '*/claim-evidence.mjs' {
  export interface ClaimEvidence {
    readonly status: 'merged' | null;
    readonly evidence: 'merged-pr' | 'branch-head-on-main' | 'branch-tree-on-main' | 'none';
    readonly why: string;
  }
  export interface MergeEvidence {
    readonly headSha: string | null;
    readonly headOnMain: boolean;
    readonly treeOnMain: string | null;
  }
  export function decideClaim(input?: {
    readonly branchExists?: boolean;
    readonly branchHeadOnMain?: boolean;
    readonly branchTreeOnMain?: string | null;
    readonly headSha?: string | null;
    readonly mergedPr?: {
      number: number;
      headRefOid?: string | null;
      mergeCommit?: string | null;
      mergeCommitSha?: string | null;
    } | null;
  }): ClaimEvidence;
  export function localMergeEvidence(input?: {
    readonly branch: string;
    readonly baseRef?: string;
    readonly git?: (args: string[]) => string;
  }): MergeEvidence;
  export function mergedPullRequestIndex(input?: {
    readonly gh?: (args: string[]) => string;
    readonly baseRef?: string;
  }): Map<
    string,
    { number: number; headRefOid: string; mergeCommit: string | null; url: string | null }
  > | null;
}
