/** Deklaration fuer das Impact-Graph-Gate. */
declare module '*/impact-graph.mjs' {
  export interface ImpactGraphViolation {
    readonly file: string;
    readonly specifier: string;
    readonly reason: string;
  }
  export interface ImpactGraphOptions {
    readonly root?: string;
    readonly entries?: readonly string[];
    readonly specifiersOf?: (file: string) => readonly string[];
    readonly resolveSpecifier?: (specifier: string, fromFile: string) => string | null;
  }
  export interface ImpactGraphResult {
    readonly ok: boolean;
    readonly modules: readonly string[];
    readonly violations: readonly ImpactGraphViolation[];
  }
  export const IMPACT_ENTRY_POINTS: readonly string[];
  export const FORBIDDEN_SPECIFIERS: readonly { readonly pattern: RegExp; readonly reason: string }[];
  export function auditImpactGraph(options?: ImpactGraphOptions): ImpactGraphResult;
}
