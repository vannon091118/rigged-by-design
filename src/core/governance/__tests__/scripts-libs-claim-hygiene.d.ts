export interface ClaimHygieneRow {
  readonly id: string;
  readonly branch: string;
  readonly owner: string;
  readonly issue: number | null;
  readonly claimStatus: string;
  readonly issueState: 'open' | 'closed' | 'unknown';
  readonly violation: boolean;
}

export interface ClaimHygieneResult {
  readonly rows: ClaimHygieneRow[];
  readonly violations: ClaimHygieneRow[];
  readonly unknown: ClaimHygieneRow[];
  readonly counts: {
    readonly claims: number;
    readonly openClaims: number;
    readonly known: number;
    readonly closedViolations: number;
    readonly unknown: number;
  };
}

export function normalizeIssueState(value: unknown): 'open' | 'closed' | 'unknown';
export function normalizeIssueStates(snapshot?: Record<string, unknown>): Map<number, 'open' | 'closed'>;
export function auditClaimHygiene(input: {
  claims?: readonly Record<string, unknown>[];
  issueStates?: Map<number, string>;
}): ClaimHygieneResult;
export function formatClaimHygiene(result: ClaimHygieneResult): string;
