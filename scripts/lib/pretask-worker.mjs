/**
 * Worker-Bootstrap vor dem ersten Edit: reservierte Identitaet, externes
 * Laufbudget und der Claim-Zustand des Issues. Fehlende Belege sind
 * fail-closed, Legacy-Arbeit ohne Budgetdatei bleibt startbar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchRole } from './worker-identity.mjs';
import { readIdentityFile, validateIdentityFile, workspaceHome, workspacePaths } from './workspace-home.mjs';
import { decideRunBudget, parseGovernanceFindingCount, readRunBudget } from './run-budget.mjs';
import { canClaimWork, evaluateWorkState } from './work-claim.mjs';
import { ROOT } from './report.mjs';

export function runWorker(ctx) {
  const {
    argv, findingFlag, branch, claim, head, blockers, warnings, issueClaim, actors,
  } = ctx;

  // Worker-Bootstrap: Rolle, Identitaet und Home stehen am Anfang jedes Laufs.
  // Die Identitaet selbst wird im Identity-Board reserviert; hier wird nur
  // gelesen und geprueft, damit ein fehlender Home kein stiller Start ist.
  const workerHome = workspaceHome();
  const workerPaths = workspacePaths(workerHome);
  const workerRecord = readIdentityFile(workerPaths.identity);
  const workerCheck = workerRecord
    ? validateIdentityFile(workerRecord)
    : { ok: false, reasons: ['identity-file-missing'] };
  const worker = {
    role: dispatchRole(),
    home: workerHome,
    identityFile: workerPaths.identity,
    identity: workerRecord?.identity ?? null,
    claimId: workerRecord?.claimId ?? null,
    activeIssue: workerRecord?.activeIssue ?? null,
    status: workerRecord?.status ?? 'IDLE',
    identityValid: workerCheck.ok,
    identityReasons: workerCheck.reasons,
  };
  if (!worker.identityValid && branch !== 'main' && claim) {
    // Harte Sperre: ohne reservierte Identitaet startet keine Lane-Arbeit.
    blockers.push(`[ERR-4027] Worker-Identitaet fehlt oder ist ungueltig (${worker.identityReasons.join(', ')}); \`pnpm run worker:init -- claim\` im Identity-Board, kein Read vor der Reservierung`);
  }

  // Externes Laufbudget: der Stop-Vertrag greift vor dem ersten Edit, nicht erst
  // beim Turn-Ende. Fehlt die Konfiguration, bleibt Legacy-Arbeit startbar.
  const budgetFile = join(ROOT, 'docs/run-budget.json');
  let runBudgetState = null;
  if (branch !== 'main' && claim && existsSync(budgetFile)) {
    try {
      const budget = readRunBudget(budgetFile);
      // Nach einem Rebase enthaelt die Lane die neuen main-Commits; gezaehlt
      // werden nur die eigenen Commits seit dem gemeinsamen Vorfahren.
      let base = claim.baseSha ?? 'origin/main';
      try {
        base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || base;
      } catch {
        // Ohne origin/main bleibt die Claim-Basis der belastbare Startpunkt.
      }
      const commits = Number(execFileSync('git', ['rev-list', '--count', `${base}..HEAD`], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim());
      // Die Zahl neuer Governance-Findings ist aus Git nicht ableitbar. Sie muss
      // belegt uebergeben werden; ein fehlender Wert ist fail-closed. Die alte
      // Verdrahtung mit einer festen 0 hat jeden Verstoss unsichtbar gemacht.
      const newGovernanceIssues = parseGovernanceFindingCount(
        process.env.RBD_NEW_GOVERNANCE_ISSUES ?? (findingFlag >= 0 ? argv[findingFlag + 1] : undefined),
      );
      if (newGovernanceIssues === null) {
        runBudgetState = { newGovernanceIssues: null, state: 'UNKNOWN', reasons: ['new-governance-issues=unknown'] };
        blockers.push(
          '[ERR-4019] Laufbudget: new-governance-issues=unknown; die Zahl der in diesem Lauf geoeffneten Governance-Issues ist nicht belegt. ' +
            'Belegte Zahl mit `--new-governance-issues <n>` oder `RBD_NEW_GOVERNANCE_ISSUES=<n>` uebergeben; 0 wird nicht mehr angenommen.',
        );
      } else {
        const decision = decideRunBudget({ commits, iterations: 1, issues: 1, newGovernanceIssues }, budget);
        runBudgetState = {
          newGovernanceIssues,
          state: decision.state,
          reasons: decision.reasons,
          findingDuty: decision.findingDuty,
        };
        if (decision.state !== 'CONTINUE') {
          blockers.push(
            `[ERR-4019] Laufbudget ${decision.state}: ${decision.reasons.join(', ')}; ` +
            `Main-SHA ${head}, Produktziele ${budget.productProgress.mergedProductPrs}/${budget.productProgress.acceptedFindings}, ` +
            'Stop durch externes Budget - kein neuer Edit in diesem Lauf',
          );
        }
      }
    } catch (error) {
      blockers.push(`[ERR-4019] Laufbudget nicht pruefbar: ${String(error?.message ?? error).slice(0, 160)}`);
    }
  }

  // Arbeits-Claim als Gate: nur autorisierte, claim-gebundene Ereignisse in
  // erlaubter Reihenfolge erzeugen den Zustand (#693); ein laufendes Review
  // sperrt neue Arbeit am Issue.
  const issueWork = Array.isArray(issueClaim.comments)
    ? evaluateWorkState(issueClaim.comments, { actors })
    : { state: 'OPEN', rejected: [] };
  const reviewStates = ['REVIEW_PENDING', 'ACCEPTED', 'MERGED'];
  const workGate = {
    state: issueWork.state,
    blocked: reviewStates.includes(issueWork.state) && Boolean(issueClaim.number),
    rejected: issueWork.rejected.length,
  };
  if (issueWork.rejected.length > 0) {
    const sample = issueWork.rejected.slice(0, 3).map((entry) => `${entry.kind}@${entry.commentId}:${entry.reason}`);
    warnings.push(`Work-Ereignisse ohne Wirkung: ${issueWork.rejected.length} (${sample.join(', ')})`);
  }
  if (workGate.blocked) {
    blockers.push(`[ERR-4027] Issue #${issueClaim.number} steht auf ${issueWork.state}: erst \`REWORK\` oder Review-Entscheid durch den Maintainer, keine neue Arbeit im selben Worker`);
  } else if (issueClaim.number && !canClaimWork(issueWork.state, { sameIssue: issueClaim.status === 'claimed-self' })) {
    blockers.push(`[ERR-4027] Issue #${issueClaim.number} ist nicht frei (${issueWork.state}); Work-Claim verweigert`);
  }

  return { worker, runBudgetState, workGate };
}
