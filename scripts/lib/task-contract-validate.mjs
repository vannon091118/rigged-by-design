/**
 * Schema und Validierung des Task-Vertrags.
 *
 * Eine Wahrheit fuer alle Aufrufer: make/transition/pretask/promote pruefen
 * hier. Die Datei kennt weder Git noch GitHub und bleibt damit testbar.
 */
export const TASK_PHASES = Object.freeze(['READY', 'IMPLEMENTING', 'CI_PENDING', 'MERGE_PENDING', 'AFTERCARE', 'DONE']);
export const PRETASK_STATUSES = Object.freeze(['READY', 'CONTINUE', 'AFTERCARE', 'MERGE_PENDING', 'BLOCKED']);
export const FINDING_STATUSES = Object.freeze(['open', 'resolved', 'accepted']);
export const FINDING_SEVERITIES = Object.freeze(['blocker', 'warning', 'info']);
export const PR_STATES = Object.freeze(['open', 'merged', 'closed']);
export const CONTRACT_STATUSES = Object.freeze(['READY_FOR_MERGE', 'HOLD', 'BLOCKED']);
export const TASK_TYPES = Object.freeze(['single', 'multi-phase', 'aftercare']);
export const CLOSEOUT_KINDS = Object.freeze(['post-merge']);
export const TASK_ID = /^[a-z0-9][a-z0-9-]*$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

export const PHASE_TRANSITIONS = Object.freeze({
  READY: ['READY', 'IMPLEMENTING', 'CI_PENDING'],
  IMPLEMENTING: ['IMPLEMENTING', 'READY', 'CI_PENDING'],
  CI_PENDING: ['CI_PENDING', 'IMPLEMENTING', 'MERGE_PENDING'],
  MERGE_PENDING: ['MERGE_PENDING', 'CI_PENDING', 'IMPLEMENTING', 'AFTERCARE'],
  AFTERCARE: ['AFTERCARE', 'IMPLEMENTING', 'MERGE_PENDING', 'DONE'],
  DONE: ['DONE'],
});

export function canTransition(from, to) {
  return (PHASE_TRANSITIONS[String(from ?? '')] ?? []).includes(String(to ?? ''));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Die einzige Validierung; `previous` aktiviert die Phasenpruefung. */
export function validateTaskContract(contract, { claim = null, branch = '', previous = null, enforceTransition = true } = {}) {
  const violations = [];
  if (!isObject(contract)) return { ok: false, violations: ['Task-Vertrag ist kein Objekt'] };
  if (contract.version !== 1) violations.push(`unbekannte Vertragsversion ${String(contract.version)}`);
  if (!TASK_ID.test(String(contract.taskId ?? ''))) violations.push('taskId fehlt oder folgt nicht dem Slug-Schema');
  if (!String(contract.claimId ?? '').trim()) violations.push('claimId fehlt');
  if (!String(contract.branch ?? '').trim()) violations.push('branch fehlt');
  if (claim) {
    if (contract.claimId !== claim.id) violations.push(`claimId '${String(contract.claimId)}' passt nicht zu '${claim.id}'`);
    if (contract.branch !== claim.branch) violations.push(`branch '${String(contract.branch)}' passt nicht zu '${claim.branch}'`);
  }
  if (branch && contract.branch !== branch) violations.push(`branch '${String(contract.branch)}' passt nicht zum Lauf '${branch}'`);
  if (!FULL_SHA.test(String(contract.baseSha ?? ''))) violations.push('baseSha ist kein vollstaendiger Commit');
  if (!TASK_PHASES.includes(contract.phase)) violations.push(`Phase '${String(contract.phase)}' ist unbekannt`);
  if (!String(contract.title ?? '').trim()) violations.push('title fehlt');
  if (typeof contract.goal !== 'string') violations.push('goal ist kein Text');
  if (contract.taskType !== undefined && !TASK_TYPES.includes(contract.taskType)) {
    violations.push(`taskType '${String(contract.taskType)}' ist unbekannt`);
  }
  if (contract.closeout !== undefined && !CLOSEOUT_KINDS.includes(contract.closeout)) {
    violations.push(`closeout '${String(contract.closeout)}' ist unbekannt`);
  }
  if (contract.holdMerge !== undefined && typeof contract.holdMerge !== 'boolean') {
    violations.push('holdMerge ist kein Boolean');
  }
  if (contract.status !== undefined && !CONTRACT_STATUSES.includes(contract.status)) {
    violations.push(`status '${String(contract.status)}' ist unbekannt`);
  }
  if (!Number.isInteger(contract.revision) || contract.revision < 1) violations.push('revision ist keine positive Ganzzahl');
  if (contract.phase !== 'DONE' && !String(contract.nextAction ?? '').trim()) violations.push('nextAction fehlt');

  if (contract.pr !== null && contract.pr !== undefined) {
    if (!isObject(contract.pr)) violations.push('pr ist weder null noch ein Objekt');
    else {
      if (!Number.isInteger(contract.pr.number) || contract.pr.number <= 0) violations.push('pr.number ist keine positive Ganzzahl');
      if (!String(contract.pr.url ?? '').trim()) violations.push('pr.url fehlt');
      if (!PR_STATES.includes(contract.pr.state)) violations.push(`pr.state '${String(contract.pr.state)}' ist unbekannt`);
    }
  }

  if (!Array.isArray(contract.findings)) {
    violations.push('findings ist keine Liste');
  } else {
    const seen = new Set();
    for (const finding of contract.findings) {
      if (!isObject(finding)) {
        violations.push('finding ist kein Objekt');
        continue;
      }
      const id = String(finding.id ?? '').trim();
      if (!id) violations.push('finding.id fehlt');
      else if (seen.has(id)) violations.push(`finding.id '${id}' ist doppelt`);
      seen.add(id);
      if (!FINDING_STATUSES.includes(finding.status)) violations.push(`finding ${id || '(ohne id)'}: status '${String(finding.status)}' ist unbekannt`);
      if (!FINDING_SEVERITIES.includes(finding.severity)) violations.push(`finding ${id || '(ohne id)'}: severity '${String(finding.severity)}' ist unbekannt`);
      if (!String(finding.summary ?? '').trim()) violations.push(`finding ${id || '(ohne id)'}: summary fehlt`);
    }
  }

  if (previous && enforceTransition && previous.phase !== contract.phase && !canTransition(previous.phase, contract.phase)) {
    violations.push(`Phasenwechsel ${previous.phase} -> ${contract.phase} ist nicht erlaubt`);
  }
  return { ok: violations.length === 0, violations };
}
