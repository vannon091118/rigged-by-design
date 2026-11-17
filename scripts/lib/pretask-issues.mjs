/**
 * Offene Issues, die den Start blockieren koennen. Die Reihenfolge ist
 * fail-closed: jede nicht lesbare Abfrage macht den Check UNKNOWN, nicht leer.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './report.mjs';
import { rest } from './github-rest.mjs';
import { buildFollowUp, classifyIssue as scopeDecision, labelNames } from './issue-scope.mjs';

/** Offene Issue-Labels, die den Start blockieren koennen; `governance/blocked`
 * schreibt `governance-issue`, nicht der Watcher. */
const ISSUE_LABELS = Object.freeze(['gate-failure', 'remote-ci', 'governance/blocked']);
/** Kontrollierte Wiederholung: erst zwei Versuche, dann Zustand UNKNOWN. */
const ISSUE_QUERY_ATTEMPTS = 2;

function readIssues() {
  const issues = new Map();
  const errors = [];
  for (const label of ISSUE_LABELS) {
    let output = null;
    for (let attempt = 1; attempt <= ISSUE_QUERY_ATTEMPTS && output === null; attempt += 1) {
      try {
        // Tests koennen einen Node-basierten Stub einsetzen; im Betrieb bleibt
        // der normale GitHub-CLI-Aufruf der einzige Pfad.
        const ghBin = process.env.RBD_GH_BIN || 'gh';
        const ghArgs = process.env.RBD_GH_SCRIPT
          ? [process.env.RBD_GH_SCRIPT, 'issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50']
          : ['issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50'];
        output = execFileSync(ghBin, ghArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        output = null;
      }
    }
    if (output === null) {
      // Zweiter Lesepfad: derselbe Aufruf ueber den Token-Connector, wenn keine
      // angemeldete `gh`-CLI vorhanden ist.
      const viaRest = rest('issue-list', { label, state: 'open', limit: 50 });
      if (viaRest.ok) output = JSON.stringify(viaRest.data);
    }
    if (output === null) {
      errors.push(label);
      continue;
    }
    try {
      for (const issue of JSON.parse(output)) {
        if (!issues.has(issue.number)) issues.set(issue.number, { ...issue, queryLabel: label });
      }
    } catch {
      // Eine unlesbare Antwort ist keine leere Liste.
      errors.push(label);
    }
  }
  return { checked: errors.length === 0, status: errors.length === 0 ? 'checked' : 'unknown', issues: [...issues.values()], errors };
}

export function runIssueChecks(ctx) {
  const { branch, claim, blockers, warnings, notes } = ctx;

  function classifyIssue(issue) {
    const decision = scopeDecision(issue, {
      branch,
      dependencies: claim?.dependencies ?? [],
      isAncestor: ctx.isAncestor,
    });
    const result = {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      body: issue.body ?? '',
      labels: labelNames(issue),
      scope: decision.scope,
      repairSha: decision.repairSha,
    };
    if (decision.disposition === 'warning') {
      if (decision.reason === 'remote-ci') {
        warnings.push(`Issue #${issue.number}: remote-ci blockiert nie`);
      } else if (decision.reason === 'repair-already-in-head') {
        warnings.push(`Issue #${issue.number}: Repair-SHA ${decision.repairSha.slice(0, 7)} ist bereits Vorfahr von HEAD`);
      } else if (decision.reason === 'no-scope') {
        warnings.push(`Issue #${issue.number}: gate-failure ohne Scope-Label; nicht global blockieren`);
      } else {
        warnings.push(`Issue #${issue.number}: Scope ${decision.scope.lane || decision.scope.kind} betrifft diese Lane nicht`);
      }
      return { ...result, disposition: 'warning', reason: decision.reason };
    }
    if (decision.reason === 'blocked-issue') {
      blockers.push(`[ERR-4019] Governance-BLOCKED #${issue.number} blockiert diese Lane`);
    } else if (decision.reason === 'scope-main') {
      blockers.push(`[ERR-4019] gate-failure #${issue.number} scope:main blockiert global`);
    } else if (decision.reason === 'scope-lane') {
      blockers.push(`[ERR-4019] gate-failure #${issue.number} betrifft die eigene Lane (${decision.scope.lane})`);
    } else {
      blockers.push(`[ERR-4019] gate-failure #${issue.number} betrifft die Dependency ${decision.scope.lane}`);
    }
    return { ...result, disposition: 'blocker', reason: decision.reason };
  }

  const issueCheck = readIssues();
  const issueResults = issueCheck.issues.map(classifyIssue);
  const followUp = buildFollowUp(issueResults);
  if (!issueCheck.checked) {
    // UNKNOWN unterscheidet jetzt lokal von Merge: ohne Issue-Abfrage ist die
    // Blockerlage unbekannt. Lokale Arbeit im Claim-Scope bleibt erlaubt (sonst
    // blockiert jede fehlende `gh`-Anmeldung den ganzen Turn), Merge und
    // Promotion bleiben fail-closed gesperrt.
    warnings.push(`[ERR-4019] Issue-Check UNKNOWN: ${issueCheck.errors.join(', ')} nicht abfragbar; lokale Arbeit erlaubt, Merge/Promotion gesperrt`);
    notes.push('Merge-Sperre: unbekannte Issue-Lage (Issue-Check UNKNOWN) haelt nur Merge und Promotion an.');
  } else if (issueResults.length === 0) {
    notes.push('Issue-Check: keine offenen gate-failure-, remote-ci- oder governance/blocked-Issues.');
  } else if (followUp.required) {
    notes.push(`Folgetask-Gate: ${followUp.problems.length} Problem(e) muessen zuerst geloest werden.`);
  }

  return { issueCheck, issueResults, followUp };
}
