/** Import-Befunde: blockieren, automatisch reparieren oder ignorieren. */
export type EscalationLevel = 'AUTO_FIX' | 'LOCAL_GATE' | 'REMOTE_CI' | 'AGENT' | 'BLOCKED';

type TransferIssueLevel = 'FATAL' | 'REPAIR' | 'IGNORE';

export interface TransferIssue {
  readonly code: string;
  readonly level: TransferIssueLevel;
  readonly path: string;
  readonly message: string;
}

/** Dieselbe Leiter wie scripts/lib/escalation.mjs; hier nur die Uebersetzung. */
const ESCALATION: Record<TransferIssueLevel, EscalationLevel> = {
  FATAL: 'BLOCKED',
  REPAIR: 'AUTO_FIX',
  IGNORE: 'LOCAL_GATE',
};

export function escalationFor(level: TransferIssueLevel): EscalationLevel {
  return ESCALATION[level];
}

export function issue(level: TransferIssueLevel, path: string, message: string): TransferIssue {
  return { code: 'ERR-5001', level, path, message };
}

export function countIssues(issues: readonly TransferIssue[]): { fatal: number; repair: number; ignored: number } {
  let fatal = 0;
  let repair = 0;
  let ignored = 0;
  for (const item of issues) {
    if (item.level === 'FATAL') fatal += 1;
    else if (item.level === 'REPAIR') repair += 1;
    else ignored += 1;
  }
  return { fatal, repair, ignored };
}

export function blocking(issues: readonly TransferIssue[]): boolean {
  return issues.some((item) => item.level === 'FATAL');
}
