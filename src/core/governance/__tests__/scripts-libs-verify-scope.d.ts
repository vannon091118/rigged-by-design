/** Deklaration fuer `verify:scope`. */
declare module '*/verify-scope.mjs' {
  export interface ScopeAssessment {
    readonly allowed: readonly string[];
    readonly foreign: readonly string[];
    readonly ok: boolean;
    readonly takeover: unknown;
  }
  export function assessScope(input?: {
    readonly changed?: readonly string[];
    readonly allowlist?: readonly string[];
    readonly claims?: readonly object[];
    readonly branch?: string;
    readonly exempt?: readonly string[];
  }): ScopeAssessment;
}
