/** Deklarationen fuer die JS-Bibliotheken unter scripts/lib (kein allowJs im Projekt). */
declare module '*/process-sweep.mjs' {
  export interface TrackedProcess {
    readonly gate: string;
    readonly pid: number;
    readonly at: number;
  }
  export function isAlive(pid: number): boolean;
  export function killTree(pid: number): boolean;
  export function killTracked(): number;
  export function trackPid(gate: string, pid: number): void;
  export function untrackPid(pid: number): void;
  export function sweepOrphans(log?: (message: string) => void): TrackedProcess[];
  export function releaseOwner(): void;
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
  }
  export const PROFILES: readonly string[];
  export const GATES: Readonly<Record<string, GateSpec>>;
  export const PROFILE_GATES: Readonly<Record<string, readonly string[]>>;
  export function isProfile(value: string): boolean;
  export function planGates(profile: string): string[] | null;
  export function isFixMode(argv: readonly string[]): boolean;
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
