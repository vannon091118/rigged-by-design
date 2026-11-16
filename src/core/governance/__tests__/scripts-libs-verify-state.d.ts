/** Deklarationen fuer den gemeinsamen Verify-Zustand (Issue #1039). */
declare module '*/verify-state.mjs' {
  export interface GateRecord {
    readonly key?: string;
    /** Numerische Infrastrukturzeit; Altbestand kann ISO-Strings tragen. */
    readonly at?: number | string;
  }
  export interface VerifyState {
    readonly version: number;
    readonly updatedAt: string | null;
    readonly meta: Readonly<Record<string, number>>;
    readonly task: Readonly<Record<string, unknown>>;
    readonly base: Readonly<Record<string, unknown>> | null;
    readonly delegated: Readonly<Record<string, unknown>> | null;
    readonly cause: Readonly<Record<string, unknown>> | null;
    readonly gates: Readonly<Record<string, GateRecord>>;
  }
  export interface RootOptions {
    readonly root?: string;
  }
  export const STATE_VERSION: number;
  export const STATE_DIR: string;
  export const STATE_FILE: string;
  export const CONTEXT_VIEW: string;
  export const SECTIONS: readonly string[];
  export function stateDir(root?: string): string;
  export function statePath(root?: string): string;
  export function stateLockPath(root?: string): string;
  export function withStateLock<T>(fn: () => T, options?: RootOptions): T;
  export function contextViewPath(root?: string): string;
  export function logsDir(root?: string): string;
  export function reportsDir(options?: { root?: string; stamp?: string | null }): string;
  export function logFilePath(label: string, options?: { root?: string; stamp?: string | null }): string;
  export function stateStamp(): number;
  export function readState(options?: RootOptions): VerifyState;
  export function readSection<T = Readonly<Record<string, unknown>>>(
    section: string,
    options?: RootOptions,
  ): T | null;
  export function setSection(section: string, value: unknown, options?: RootOptions): unknown;
  export function updateSection(
    section: string,
    patch: Readonly<Record<string, unknown>> | null,
    options?: RootOptions,
  ): Readonly<Record<string, unknown>> | null;
  export function clearSection(section: string, options?: RootOptions): unknown;
  export function readGates(options?: RootOptions): Readonly<Record<string, GateRecord>>;
  export function writeGate(name: string, record: GateRecord, options?: RootOptions): GateRecord;
  export function dropGate(name: string, options?: RootOptions): boolean;
  export function writeContextView(value: unknown, options?: RootOptions): {
    readonly file: string | null;
    readonly bytes: number;
  };
  export function migrateLegacy(options?: RootOptions): {
    readonly migrated: readonly string[];
    readonly removed: readonly string[];
  };
  export function gcVerifyState(options?: RootOptions & {
    now?: number;
    ttlDays?: number;
    reportDays?: number;
  }): { readonly removed: readonly string[]; readonly state: VerifyState };
}
