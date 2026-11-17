/**
 * Gruener Merge: erst PR-Status, Vertrag, Scope, Plan und Basis pruefen, dann
 * mit dem erhaltenen PR-Body auf dem exakten Kopf squashen. Kein Auto-Merge.
 */
export function createMergeGreen({
  gh, git, headRef, verifiedPr, holdPromotion, readPlanArtifact, validatePlanArtifact,
  blockedIssues, contractHoldReason, mergeText, writeBodyFile, writeCiState, syncTaskLabels,
  readTaskContractAtRef, validateTaskContract, blockerFindings, subject,
  elevated, headSha, baseSha, MAIN, branch, staleBase, warn, log,
}) {
  return (number) => {
    const info = verifiedPr(number);
    if (!info) return holdPromotion(number, null, 'PR-Status nicht verifiziert');
    const ref = headRef();
    const contractRef = readTaskContractAtRef(ref, { branch });
    const contract = contractRef?.contract ?? null;
    if (contractRef) {
      const contractCheck = validateTaskContract(contract, { branch });
      if (!contractCheck.ok) {
        return holdPromotion(number, contract, `Task-Vertrag ungueltig: ${contractCheck.violations.join('; ')}`);
      }
      if (blockerFindings(contract).length > 0) {
        return holdPromotion(number, contract, `${blockerFindings(contract).length} offene Blocker im Task-Vertrag`);
      }
    } else {
      warn(`PR #${number}: kein Task-Vertrag am Kopf; Legacy-Merge mit Warnung`);
    }

    const plan = readPlanArtifact();
    const planCheck = validatePlanArtifact(plan, { headSha, baseSha });
    if (!planCheck.ok) return holdPromotion(number, contract, planCheck.reason);

    const mainNow = git(['rev-parse', 'origin/main']) ?? '';
    const stale = staleBase(baseSha, mainNow);
    if (stale) {
      gh(['pr', 'update-branch', String(number)]);
      return holdPromotion(number, contract, `${stale}; Branch wird aktualisiert, der neue Lauf entscheidet.`);
    }

    const blocked = blockedIssues();
    if (blocked === null) {
      return holdPromotion(number, contract, 'BLOCKED-Status unbekannt: Issue-Liste nicht lesbar (fail-closed)');
    }
    if (blocked.length > 0) {
      return holdPromotion(number, contract, `BLOCKED-Issue im Scope: ${blocked.map((issue) => `#${issue.number}`).join(', ')}`);
    }

    const contractHold = contractHoldReason(contract);
    if (contractHold) return holdPromotion(number, contract, contractHold);

    const current = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
    if (current === null) return holdPromotion(number, contract, 'PR-Body nicht lesbar');
    const composed = mergeText(current, ref);
    if (!composed.ok) return holdPromotion(number, contract, composed.reason);

    const bodyFile = writeBodyFile(composed.body, 'body.md');
    const merged = gh(['pr', 'merge', number, '--squash', '--match-head-commit', headSha, '--subject', subject(ref), '--body-file', bodyFile]) !== null;
    if (!merged) return holdPromotion(number, contract, 'GitHub hat den Merge auf dem exakten Kopf abgelehnt');

    writeCiState({
      number,
      state: 'SUCCESS',
      conclusion: 'success',
      contract,
      nextAction: 'Gemergt; Nachsorge starten.',
    });
    if (contract) syncTaskLabels(number, { ...contract, phase: 'AFTERCARE', taskType: 'aftercare' }, false);
    if (!elevated) {
      if (gh(['workflow', 'run', 'Auto Version & Release', '--ref', MAIN]) !== null) log('Release-Lauf ohne eigenes Token angestossen');
      else warn('Merge ohne PROMOTE_TOKEN; Release-Lauf nicht angestossen');
    }
    return true;
  };
}
