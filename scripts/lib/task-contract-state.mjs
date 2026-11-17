/**
 * Statusableitung des Task-Vertrags. Reine Funktionen ohne Git, Netz oder
 * Dateisystem; `pretask` entscheidet damit, was als Naechstes zu tun ist.
 */
export function openFindings(contract) {
  return (contract?.findings ?? []).filter((finding) => finding.status === 'open');
}

export function blockerFindings(contract) {
  return openFindings(contract).filter((finding) => finding.severity === 'blocker');
}

/**
 * Leitet den pretask-Status ab. `CI_PENDING` ist nur der gepushte Zustand;
 * der lokale Nachweis entscheidet, kein Warten auf CI. Ein gemergter PR fuehrt
 * in die Nachsorge.
 */
export function deriveTaskState({ contract = null, claim = null, blockers = [], pr = null, ci = null } = {}) {
  const findings = openFindings(contract);
  const base = {
    status: 'CONTINUE',
    phase: contract?.phase ?? 'READY',
    nextAction: contract?.nextAction ?? 'Task-Vertrag fehlt; `pnpm run turn:finish` legt ihn beim ersten Turn aus dem Claim an.',
    findings,
    parallelLane: null,
  };
  if (blockers.length > 0) {
    return { ...base, status: 'BLOCKED', nextAction: `Blockers aufloesen: ${blockers[0]}` };
  }
  if (!contract) {
    return { ...base, status: 'READY', phase: 'READY', nextAction: `Task-Vertrag fehlt (${claim?.id ?? 'Lane'}); er entsteht automatisch beim ersten \`pnpm run turn:finish\`.` };
  }
  if (pr?.merged || contract.phase === 'DONE') {
    const isDone = contract.phase === 'DONE' && !pr?.merged;
    return {
      ...base,
      status: 'AFTERCARE',
      phase: isDone ? 'DONE' : 'AFTERCARE',
      nextAction: isDone ? 'Abgeschlossen; neue Arbeit als neue Lane starten.' : 'Nachsorge abschliessen und den Vertrag auf DONE setzen.',
    };
  }
  if (ci?.state === 'HOLD') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'Hold: Merge ist gesperrt; Vertrag oder Blocker pruefen.' };
  }
  if (ci?.state === 'REMOTE_CI') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'REMOTE_CI: CI erneut starten; kein BLOCKED.' };
  }
  if (ci?.state === 'SUPERSEDED') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'Ein neuerer Lauf ist die Autoritaet; diesen Zustand nicht als Merge-Beleg verwenden.' };
  }
  if (contract.phase === 'CI_PENDING') {
    return {
      ...base,
      status: 'MERGE_PENDING',
      nextAction: 'Lokaler Vor-PR-Nachweis ist die Autoritaet; der PR-Check ist optional. Review und Merge durch Mensch/Agent auf dem exakten Kopf.',
    };
  }
  if (contract.phase === 'MERGE_PENDING') {
    return { ...base, status: 'MERGE_PENDING', nextAction: contract.nextAction || 'Merge auf dem exakten Kopf; danach Nachsorge.' };
  }
  if (contract.phase === 'AFTERCARE') {
    return { ...base, status: 'AFTERCARE', nextAction: contract.nextAction || 'Nachsorge abschliessen und den Vertrag auf DONE setzen.' };
  }
  if (contract.phase === 'READY') {
    return { ...base, status: 'READY', nextAction: contract.nextAction || 'Erste Aenderung innerhalb der Allowlist beginnen.' };
  }
  return base;
}
