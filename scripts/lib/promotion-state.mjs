/**
 * Promotion-Entscheidung: aus CI-Plan, Task-Vertrag und BLOCKED-Issues wird
 * genau eine Aktion. Die Funktionen sind rein; `promote.mjs` liefert die
 * Daten aus Git, GitHub und dem heruntergeladenen Plan-Artefakt.
 */
export const TASK_TYPES = Object.freeze(['single', 'multi-phase', 'aftercare']);
export const CONTRACT_STATUSES = Object.freeze(['READY_FOR_MERGE', 'HOLD', 'BLOCKED']);

const FULL_SHA = /^[0-9a-f]{40}$/;

export function taskTypeOf(contract) {
  // Die Phase ist die staerkere Aussage: nach dem Merge ist jede Lane
  // Aftercare, auch wenn der Vertrag zuvor `single` oder `multi-phase` war.
  if (contract?.phase === 'AFTERCARE' || contract?.phase === 'DONE') return 'aftercare';
  if (TASK_TYPES.includes(contract?.taskType)) return contract.taskType;
  return 'single';
}

/**
 * Hold-Gruende aus dem Vertrag. Ein fehlender Vertrag ist Legacy und blockiert
 * nicht; ein vorhandener Vertrag muss merge-bereit sein.
 */
export function contractHoldReason(contract) {
  if (!contract) return null;
  if (contract.holdMerge === true) return 'holdMerge=true';
  if (contract.status && contract.status !== 'READY_FOR_MERGE') {
    return `status=${contract.status}`;
  }
  if (!['CI_PENDING', 'MERGE_PENDING'].includes(contract.phase)) {
    return `phase=${contract.phase}`;
  }
  return null;
}

/** Das Plan-Artefakt muss zu genau diesem Lauf, Kopf und dieser Basis gehoeren. */
export function validatePlanArtifact(plan, { headSha = '', baseSha = '' } = {}) {
  if (!plan || typeof plan !== 'object') {
    return { ok: false, reason: 'CI-Plan-Artefakt fehlt oder ist nicht lesbar' };
  }
  if (plan.state !== 'PR') {
    return { ok: false, reason: `CI-Plan-Zustand '${plan.state ?? '(leer)'}' ist nicht PR` };
  }
  if (plan.head && plan.head !== headSha) {
    return { ok: false, reason: `CI-Plan-Kopf ${String(plan.head).slice(0, 7)} passt nicht zu ${headSha.slice(0, 7)}` };
  }
  if (plan.base && plan.base !== baseSha) {
    return { ok: false, reason: `CI-Plan-Basis ${String(plan.base).slice(0, 7)} passt nicht zu ${baseSha.slice(0, 7)}` };
  }
  return { ok: true, reason: 'CI-Plan gehoert zu diesem PR-Lauf' };
}

/** Die Labels spiegeln den Vertrag; `task:hold` schliesst `task:ready` aus. */
export function promotionLabels(contract, hold = false) {
  const labels = new Set([`task:${taskTypeOf(contract)}`]);
  labels.add(hold ? 'task:hold' : 'task:ready');
  return [...labels].sort();
}

export function labelDiff(current = [], desired = []) {
  const have = new Set(current);
  const want = new Set(desired);
  return {
    add: [...want].filter((label) => !have.has(label)),
    remove: [...have].filter((label) => label.startsWith('task:') && !want.has(label)),
  };
}

export function staleBase(baseSha, currentMain) {
  return baseSha && currentMain && baseSha !== currentMain
    ? `Basis ${baseSha.slice(0, 7)} ist nicht mehr main ${currentMain.slice(0, 7)}`
    : null;
}

export { FULL_SHA };
