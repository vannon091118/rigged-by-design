/** Deklarationen fuer die JS-Bibliotheken unter scripts/lib (kein allowJs im Projekt). */
declare module '*/process-sweep.mjs' {
  export interface TrackedProcess {
    readonly gate: string;
    readonly pid: number;
    readonly at: number;
    readonly start: string | null;
  }
  export function isAlive(pid: number): boolean;
  export function processIdentity(pid: number): string | null;
  export function killTree(pid: number, expectedStart?: string | null): boolean;
  export function killTracked(): number;
  export function trackPid(gate: string, pid: number): void;
  export function untrackPid(pid: number): void;
  export function sweepOrphans(log?: (message: string) => void): TrackedProcess[];
  export function releaseOwner(): void;
}

declare module '*/affected-tests.mjs' {
  export interface AffectedSelection {
    readonly tests: readonly string[];
    readonly runAll: boolean;
    readonly reason: string | null;
  }
  export function listTests(): string[];
  export function selectAffectedTests(changedFiles: readonly string[]): AffectedSelection;
  export function changedFiles(): string[];
}

declare module '*/test-catalog.mjs' {
  export const PROOF_CLASSES: readonly string[];
  export const LONG_PROOF_CLASSES: readonly string[];
  export const CATALOG_START: string;
  export const CATALOG_END: string;
  export interface CatalogEntry {
    readonly file: string;
    readonly target: string | null;
    readonly system: string;
    readonly proof: string;
    readonly long: boolean;
  }
  export function testTargetOf(file: string): string | null;
  export function systemOfTarget(target: string | null): string;
  export function proofClassOf(file: string): string;
  export function testFiles(): string[];
  export function catalogEntries(files?: readonly string[]): CatalogEntry[];
  export function partitionByProof(tests: readonly string[]): { fast: string[]; long: string[] };
  export function renderCatalog(entries?: readonly CatalogEntry[]): string;
}

declare module '*/gate-runner.mjs' {
  export interface GateStep {
    readonly name: string;
    readonly command: 'npm' | 'node';
    readonly script: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
  }
  export interface GateResult {
    readonly status: number | null;
    readonly output: string;
    readonly ms: number;
    readonly timedOut: boolean;
    readonly timeoutMs: number;
  }
  export function executeStep(step: GateStep): Promise<GateResult>;
  export function runGates(steps: readonly GateStep[]): Promise<string[]>;
}

declare module '*/pipeline-stop.mjs' {
  type StopOptions = { exit?: (code: number) => void; log?: (message: string) => void };
  export const EXIT_ABORTED: number;
  export function createStop(options?: StopOptions): (signal: string) => void;
  export function installStopHandlers(options?: StopOptions): (signal: string) => void;
}

declare module '*/pipeline-plan.mjs' {
  export interface GateSpec {
    readonly name: string;
    readonly command: 'npm' | 'node';
    readonly script: string;
    readonly args?: readonly string[];
    readonly code: string;
    readonly cache?: boolean;
    readonly timeoutMs?: number;
  }
  export const PROFILES: readonly string[];
  export const GATES: Readonly<Record<string, GateSpec>>;
  export const PROFILE_GATES: Readonly<Record<string, readonly string[]>>;
  export function isProfile(value: string): boolean;
  export function planGates(profile: string): string[] | null;
  export function isFixMode(argv: readonly string[]): boolean;
}

declare module '*/release-escalation.mjs' {
  export const LEVELS: readonly string[];
  export const MAX_RETRIES: number;
  export function classifyFailure(message: unknown): 'EXISTS' | 'PERMISSION' | 'TRANSIENT' | 'UNKNOWN';
  export function escalate(
    level: string,
    kind: string,
    options?: { hasElevatedToken?: boolean },
  ): string;
  export function tokenFor(level: string, env: Record<string, string | undefined>): string;
  export function blockedReason(kind: string): string;
}

declare module '*/tree-changes.mjs' {
  export interface TreeChanges {
    readonly added: readonly string[];
    readonly modified: readonly string[];
    readonly deleted: readonly string[];
  }
  export function parsePorcelain(text: string): Map<string, string>;
  export function diffTree(
    before: string | Map<string, string>,
    after: string | Map<string, string>,
  ): TreeChanges;
  export function describeChanges(changes: TreeChanges): string[];
}
