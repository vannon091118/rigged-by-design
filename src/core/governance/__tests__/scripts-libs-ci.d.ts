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

declare module '*/promote-guard.mjs' {
  export function promotionPrListArgs(head: string, base?: string): string[];
  export function manualDispatchAction(mode?: string): 'inspect' | 'integrate';
}

declare module '*/pr-watcher.mjs' {
  export interface WatcherApiResponse {
    readonly ok: boolean;
    readonly status?: number;
    json(): Promise<unknown>;
  }
  export type WatcherApi = (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<WatcherApiResponse>;
  export function recordRecurrence(
    issue: { readonly number: number; readonly state?: string },
    runUrl: string,
    deps?: { readonly api?: WatcherApi },
  ): Promise<void>;
  export function sweepGreenMain(deps?: {
    readonly api?: WatcherApi;
    readonly git?: (args: string[]) => string;
    readonly mainSha?: string;
  }): Promise<void>;
}

declare module '*/ci-plan.mjs' {
  export interface TestSelection {
    readonly files: readonly string[];
    readonly long: readonly string[];
    readonly runAll: boolean;
    readonly reason: string;
    readonly shards: readonly { readonly shard: number; readonly files: readonly string[] }[];
  }
  export interface Plan {
    readonly changed: readonly string[];
    readonly gates: readonly { readonly gate: string }[];
    readonly gateKeys: readonly string[];
    readonly reason: string;
    readonly skipped: readonly { readonly gate: string; readonly reason: string }[];
    readonly tests: TestSelection;
    readonly advisory: readonly string[];
    readonly required: readonly string[];
  }
  export function selectTests(
    changed: readonly string[],
    options?: {
      readonly profile?: string;
      readonly impact?: boolean;
      readonly fullTests?: boolean;
      readonly base?: string;
      readonly head?: string;
    },
  ): TestSelection;
  export function buildPlan(
    changed: readonly string[],
    options?: {
      readonly profile?: string;
      readonly impact?: boolean;
      readonly fullTests?: boolean;
      readonly base?: string;
      readonly head?: string;
    },
  ): Plan;
  export function planReport(
    changed: readonly string[],
    plan: Plan,
  ): Record<string, unknown>;
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
