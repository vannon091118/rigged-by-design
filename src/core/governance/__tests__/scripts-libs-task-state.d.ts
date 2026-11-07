/** Deklarationen fuer den Task-Zustand (Phase 4). */
declare module '*/task-state.mjs' {
  export type AfterTaskState = 'TESTS_PASSED' | 'CI_PENDING';
  export interface AfterTaskRecord {
    readonly version: number;
    readonly state: string;
    readonly branch: string;
    readonly head: string;
    readonly base: string;
    readonly claim: { readonly id: string; readonly owner: string | null; readonly branch: string } | null;
    readonly paths: { readonly own: readonly string[]; readonly foreign: readonly string[] };
    readonly tests: Readonly<Record<string, unknown>>;
    readonly gate: Readonly<Record<string, unknown>>;
    readonly next: readonly string[];
    readonly updatedAt: string;
    readonly previousState?: string;
    readonly pausedAt?: string | null;
  }
  export interface AfterTaskInput {
    readonly branch: string;
    readonly head: string;
    readonly base?: string;
    readonly claim?: { readonly id: string; readonly owner?: string | null; readonly branch?: string } | null;
    readonly own?: readonly string[];
    readonly foreign?: readonly string[];
    readonly tests?: Readonly<Record<string, unknown>>;
    readonly gate?: Readonly<Record<string, unknown>>;
    readonly next?: readonly string[];
    readonly state: AfterTaskState;
  }
  export interface ResumeDecision {
    readonly ok: boolean;
    readonly state: string | null;
    readonly reasons: readonly string[];
    readonly noRecord?: boolean;
  }
  export const AFTER_TASK_FILE: string;
  export const TASK_STATE_FILE: string;
  export const TASK_PAUSED: string;
  export const TASK_COMPLETE: string;
  export function afterTaskState(input?: { gateOk?: boolean; pushed?: boolean }): AfterTaskState | null;
  export function afterTaskRecord(input: AfterTaskInput): AfterTaskRecord;
  export function readAfterTask(options?: { root?: string }): AfterTaskRecord | null;
  export function writeAfterTask(
    patch: Partial<AfterTaskRecord> & { state?: string },
    options?: { root?: string },
  ): AfterTaskRecord;
  export function pauseTask(options?: {
    reason?: string;
    root?: string;
    git?: (args: string[]) => string;
  }): AfterTaskRecord;
  export function resumeDecision(input?: {
    record?: AfterTaskRecord | null;
    branch?: string;
    claim?: { readonly branch: string; readonly pathAllowlist?: readonly string[] } | null;
    isWorktree?: boolean;
    dirtyPaths?: readonly string[];
  }): ResumeDecision;
  export function resumeTask(input?: {
    record?: AfterTaskRecord | null;
    branch?: string;
    claim?: { readonly branch: string; readonly pathAllowlist?: readonly string[] } | null;
    isWorktree?: boolean;
    dirtyPaths?: readonly string[];
    root?: string;
  }): ResumeDecision;
  export function completeDecision(input?: {
    record?: AfterTaskRecord | null;
    headSha?: string;
    run?: {
      readonly headSha?: string;
      readonly status?: string;
      readonly conclusion?: string;
      readonly url?: string;
      readonly workflowName?: string;
    } | null;
  }): { readonly ok: boolean; readonly reasons: readonly string[] };
  export function completeTask(options?: {
    runId?: string | number;
    root?: string;
    gh?: (args: string[]) => string;
    git?: (args: string[]) => string;
  }): { readonly ok: boolean; readonly reasons?: readonly string[]; readonly record?: AfterTaskRecord };
  export function statusReport(options?: { root?: string }): {
    readonly state: string;
    readonly afterTask: AfterTaskRecord | null;
    readonly pretask: Readonly<Record<string, unknown>> | null;
  };
}
