/** Deklarationen fuer die Registry-Importgrenze (Issue #1041). */
declare module '*/import-boundary.mjs' {
  export const REGISTRY_FILE: string;
  export const REGISTRY_SURFACE: string;
  export interface BoundaryViolation {
    readonly file: string;
    readonly specifier: string;
  }
  export interface BoundaryResult {
    readonly ok: boolean;
    readonly violations: readonly BoundaryViolation[];
    readonly scanned: number;
  }
  export function registrySpecifiersIn(text: string): readonly string[];
  export function auditRegistryBoundary(options?: {
    root?: string;
    files?: readonly string[] | null;
  }): BoundaryResult;
}
