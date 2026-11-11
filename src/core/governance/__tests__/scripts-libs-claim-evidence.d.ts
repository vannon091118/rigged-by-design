/** Deklarationen fuer Merge-Evidenz und den lesenden Claim-Reconcile. */
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
    readonly atBase: boolean;
  }
  export function decideClaim(input?: {
    readonly branchExists?: boolean;
    readonly branchAtBase?: boolean;
    readonly branchHeadOnMain?: boolean;
    readonly branchTreeOnMain?: string | null;
    readonly headSha?: string | null;
    readonly mergedPr?: {
      number: number;
      headRefOid?: string | null;
      mergeCommit?: string | null;
      mergeCommitSha?: string | null;
    } | null;
    readonly mergedOnMain?: boolean;
  }): ClaimEvidence;
  export function commitOnMain(input?: {
    readonly sha: string;
    readonly baseRef?: string;
    readonly git?: (args: string[]) => string;
  }): boolean;
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
  export function remoteHeads(input?: {
    readonly git?: (args: string[]) => string;
  }): Map<string, string> | null;
  export function planReconcile(input?: {
    readonly claims?: readonly { readonly id: string; readonly branch: string; readonly status: string }[];
    readonly baseRef?: string;
    readonly git?: (args: string[]) => string;
    readonly gh?: (args: string[]) => string;
    readonly prIndex?: Map<
      string,
      { number: number; headRefOid: string; mergeCommit: string | null; url: string | null }
    > | null;
  }): {
    readonly changes: readonly {
      readonly id: string;
      readonly branch: string;
      readonly status: 'merged';
      readonly evidence: 'merged-pr' | 'head-on-main' | 'tree-on-main';
      readonly sha: string | null;
      readonly why: string;
    }[];
    readonly unresolved: readonly { readonly id: string; readonly why: string }[];
    readonly prIndex: Map<
      string,
      { number: number; headRefOid: string; mergeCommit: string | null; url: string | null }
    > | null;
    readonly remoteHeads: Map<string, string> | null;
  };
}
