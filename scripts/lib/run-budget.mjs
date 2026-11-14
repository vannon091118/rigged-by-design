/**
 * Externes Laufbudget: eine Wahrheit für Stop-Entscheidung und Finding-Gate.
 *
 * Die Grenzen stehen in `docs/run-budget.json`, nicht im Agenten-Output. Der
 * CLI liest Ist-Werte aus Git bzw. dem Aufruf; ein Agent kann die Grenzen nur
 * durch einen sichtbaren Governance-Commit ändern. Das Kill-Switch-Feld ist
 * ausschließlich eine Stop-Quelle, kein Continue-Override.
 */
import { readFileSync } from 'node:fs';

export const RUN_BUDGET_VERSION = 1;
export const RUN_STATES = Object.freeze(['CONTINUE', 'KILL_SWITCH', 'BUDGET_EXHAUSTED']);
export const FINDING_AREAS = Object.freeze(['product', 'infrastructure']);
export const FINDING_SEVERITIES = Object.freeze(['P0', 'P1', 'P2', 'P3']);

const LIMIT_KEYS = Object.freeze(['maxIterations', 'maxIssues', 'maxCommits', 'maxNewGovernanceIssues']);
const PROGRESS_KEYS = Object.freeze(['mergedProductPrs', 'acceptedFindings']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function count(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`Laufbudget: Zaehler muss eine nichtnegative Ganzzahl sein, erhielt '${String(value)}'`);
  }
  return value;
}

/** Validiert die externe Konfiguration fail-closed; unbekannte Versionen sind ungueltig. */
export function validateRunBudget(raw) {
  const errors = [];
  if (!isObject(raw)) return { ok: false, errors: ['Run-Budget muss ein Objekt sein'] };
  if (raw.version !== RUN_BUDGET_VERSION) errors.push(`version muss ${RUN_BUDGET_VERSION} sein`);
  if (typeof raw.killSwitch !== 'boolean') errors.push('killSwitch muss boolean sein');
  for (const key of LIMIT_KEYS) {
    if (!Number.isInteger(raw[key]) || raw[key] < 0) errors.push(`${key} muss eine nichtnegative Ganzzahl sein`);
  }
  if (Number.isInteger(raw.maxCommits) && raw.maxCommits < 1) errors.push('maxCommits muss mindestens 1 sein');
  if (!isObject(raw.productProgress)) {
    errors.push('productProgress muss ein Objekt sein');
  } else {
    for (const key of PROGRESS_KEYS) {
      if (!Number.isInteger(raw.productProgress[key]) || raw.productProgress[key] < 0) {
        errors.push(`productProgress.${key} muss eine nichtnegative Ganzzahl sein`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    budget: {
      version: raw.version,
      killSwitch: raw.killSwitch,
      maxIterations: raw.maxIterations,
      maxIssues: raw.maxIssues,
      maxCommits: raw.maxCommits,
      maxNewGovernanceIssues: raw.maxNewGovernanceIssues,
      productProgress: {
        mergedProductPrs: raw.productProgress.mergedProductPrs,
        acceptedFindings: raw.productProgress.acceptedFindings,
      },
    },
  };
}

/** Liest die Konfiguration; fehlende oder ungueltige Dateien blockieren den Lauf. */
export function readRunBudget(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Run-Budget nicht lesbar (${file}): ${String(error?.message ?? error).slice(0, 160)}`, { cause: error });
  }
  const result = validateRunBudget(raw);
  if (!result.ok) throw new Error(`Run-Budget ungueltig (${file}): ${result.errors.join('; ')}`);
  return result.budget;
}

/**
 * Entscheidet den Lauf aus Ist-Zaehlern und externen Grenzen. Das Kill-Switch
 * hat Vorrang; jeder Grenzverstoss beendet den Lauf mit BUDGET_EXHAUSTED.
 */
export function decideRunBudget(input, budget) {
  const validation = validateRunBudget(budget);
  if (!validation.ok) throw new Error(`Run-Budget ungueltig: ${validation.errors.join('; ')}`);
  const limits = validation.budget;
  const counts = {
    commits: count(input?.commits ?? 0),
    iterations: count(input?.iterations ?? 1),
    issues: count(input?.issues ?? 1),
    newGovernanceIssues: count(input?.newGovernanceIssues ?? 0),
  };
  const reasons = [];
  if (limits.killSwitch) reasons.push('kill-switch');
  if (counts.commits > limits.maxCommits) reasons.push(`commits>${limits.maxCommits}`);
  if (counts.iterations > limits.maxIterations) reasons.push(`iterations>${limits.maxIterations}`);
  if (counts.issues > limits.maxIssues) reasons.push(`issues>${limits.maxIssues}`);
  if (counts.newGovernanceIssues > limits.maxNewGovernanceIssues) {
    reasons.push(`new-governance-issues>${limits.maxNewGovernanceIssues}`);
  }
  const state = reasons.includes('kill-switch') ? 'KILL_SWITCH' : reasons.length > 0 ? 'BUDGET_EXHAUSTED' : 'CONTINUE';
  return {
    state,
    reasons,
    counts,
    limits: {
      maxIterations: limits.maxIterations,
      maxIssues: limits.maxIssues,
      maxCommits: limits.maxCommits,
      maxNewGovernanceIssues: limits.maxNewGovernanceIssues,
    },
    productProgress: limits.productProgress,
    governanceChurn: counts.newGovernanceIssues,
  };
}

/**
 * Zahl der in einem Lauf geoeffneten Governance-Findings: nur ein belegter
 * Aufrufwert ist eine Zahl. Fehlt er, ist der Wert `null` (unknown) und das
 * Startgate blockiert - ein angenommenes 0 hat Verstoesse unsichtbar gemacht.
 */
export function parseGovernanceFindingCount(value) {
  if (value === undefined || value === null || value === '' || value === 'unknown') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < 0) {
    throw new TypeError(`new-governance-issues muss eine nichtnegative Ganzzahl oder 'unknown' sein, erhielt '${String(value)}'`);
  }
  return number;
}

/**
 * Finding-Gate: Ein neues Finding ohne Beleg, aktuellen Main-SHA,
 * Duplikatpruefung, Severity und Zuordnung wird nicht als Issue akzeptiert.
 */
export function validateFinding(raw) {
  const errors = [];
  if (!isObject(raw)) return { ok: false, errors: ['Finding muss ein Objekt sein'] };
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (summary.length < 8 || summary.length > 200) errors.push('summary muss 8 bis 200 Zeichen haben');
  const evidence = typeof raw.evidence === 'string' ? raw.evidence.trim() : '';
  if (evidence.length < 3) errors.push('evidence fehlt (Datei:Zeile oder reproduzierbarer Befehl)');
  if (!/^[0-9a-f]{40}$/.test(String(raw.mainSha ?? ''))) errors.push('mainSha muss ein vollstaendiger 40-stelliger Commit sein');
  const duplicateCheck = typeof raw.duplicateCheck === 'string' ? raw.duplicateCheck.trim() : '';
  if (duplicateCheck.length < 3) errors.push('duplicateCheck fehlt (Suche/Issue-Nummern)');
  if (!FINDING_SEVERITIES.includes(raw.severity)) errors.push(`severity muss ${FINDING_SEVERITIES.join('/')} sein`);
  if (!FINDING_AREAS.includes(raw.area)) errors.push(`area muss ${FINDING_AREAS.join('/')} sein`);
  if (raw.area === 'product' && !(typeof raw.productGoal === 'string' && raw.productGoal.trim())) {
    errors.push('productGoal fehlt fuer area=product');
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], finding: { ...raw, summary, evidence, duplicateCheck } };
}
