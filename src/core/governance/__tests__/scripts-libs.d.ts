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
