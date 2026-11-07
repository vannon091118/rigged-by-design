/**
 * Mehrfach-Diagnose eines roten CI-Laufs.
 *
 * Ein Lauf kann mehrere unabhaengige Fehler enthalten. Diese reine Auswertung
 * sammelt **alle** fehlgeschlagenen Jobs und Schritte, liest je Befund den
 * ersten echten Fehlercode aus dem Log (PASS-Zeilen zaehlen nicht) und
 * gruppiert gemeinsame Root Causes. Die Eskalationsstufe kommt aus der einen
 * Leiter in `escalation.mjs`, nicht aus einer zweiten Klassifikation.
 */
import { plan } from './escalation.mjs';

/**
 * @typedef {object} GateFailure
 * @property {string} gate
 * @property {string|null} step
 * @property {string} code
 * @property {string} line
 * @property {string} level
 * @property {string|null} failedTest
 * @property {string|null} url
 */

const GATE_FAILURE = /\[IDX-\d{4}\] \[ERR-\d{4}\].*Gate fehlgeschlagen/;
const ANY_FAILURE = /\[IDX-\d{4}\] \[ERR-\d{4}\]/;
const CODE = /(ERR-\d{4})/;
const FILE = /(src\/[^\s:]+|scripts\/[^\s:]+)\.[cm]?[jt]sx?/;

const isPass = (line) => /:\s*PASS\s*$/.test(String(line).trim());

/**
 * Erster echter Fehlercode eines Logs; `null`, wenn keine rote Zeile existiert.
 *
 * @param {string} text
 * @returns {{ code: string, line: string, failedTest: string|null }|null}
 */
export function errorFromLog(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const gateFailures = lines.filter((line) => GATE_FAILURE.test(line));
  const candidate = gateFailures.length > 0
    ? gateFailures[gateFailures.length - 1]
    : lines.filter((line) => ANY_FAILURE.test(line) && !isPass(line)).pop();
  if (!candidate) return null;
  const code = CODE.exec(candidate)?.[1];
  if (!code) return null;
  const failedTest = lines.map((line) => FILE.exec(line)?.[0]).filter(Boolean).pop();
  return { code, line: candidate.trim().slice(0, 180), failedTest: failedTest ?? null };
}

/**
 * Alle roten Befunde eines Laufs, ein Eintrag je fehlgeschlagenem Schritt.
 *
 * @param {readonly Record<string, any>[]} jobs
 * @param {Map<number, string>|Record<number, string>} [logs]
 * @returns {GateFailure[]}
 */
export function failuresFromJobs(jobs, logs = new Map()) {
  const failures = [];
  for (const job of jobs ?? []) {
    if (!job || job.conclusion === 'success' || job.conclusion === 'skipped' || job.conclusion === 'cancelled') continue;
    const text = logs?.get?.(job.id) ?? logs?.[job.id] ?? '';
    const found = errorFromLog(text);
    const code = found?.code ?? 'ERR-0000';
    const line = found?.line ?? 'Kein Fehlercode im Gate-Log gefunden';
    const level = plan(line, code === 'ERR-0000' ? null : code).level;
    const failedSteps = (job.steps ?? []).filter((step) => step.conclusion === 'failure');
    const steps = failedSteps.length > 0 ? failedSteps.map((step) => step.name) : [null];
    for (const step of steps) {
      failures.push({
        gate: job.name ?? 'unbekannt',
        step,
        code,
        line,
        level,
        failedTest: found?.failedTest ?? null,
        url: job.html_url ?? null,
      });
    }
  }
  return failures;
}

/**
 * Gruppiert Befunde nach Fehlercode: eine Ursache, mehrere Gates.
 *
 * @param {readonly GateFailure[]} failures
 * @returns {{ code: string, level: string, gates: string[], lines: string[] }[]}
 */
export function groupFailures(failures) {
  const groups = new Map();
  for (const failure of failures ?? []) {
    const entry = groups.get(failure.code) ?? { code: failure.code, level: failure.level, gates: [], lines: [] };
    if (!entry.gates.includes(failure.gate)) entry.gates.push(failure.gate);
    if (failure.line && !entry.lines.includes(failure.line)) entry.lines.push(failure.line);
    groups.set(failure.code, entry);
  }
  return [...groups.values()];
}

/**
 * Vollstaendige Diagnose: Befunde, Gruppen, Kurzbericht und der erste Befund.
 *
 * @param {{ jobs?: readonly Record<string, any>[], logs?: Map<number, string>|Record<number, string> }} [input]
 * @returns {{ failures: GateFailure[], groups: { code: string, level: string, gates: string[], lines: string[] }[], report: string, codes: string[], primary: GateFailure }}
 */
export function diagnose({ jobs, logs } = {}) {
  const failures = failuresFromJobs(jobs, logs);
  const groups = groupFailures(failures);
  const report = failures.length === 0
    ? 'Kein fehlgeschlagener Job oder Schritt gefunden.'
    : failures
      .map((failure) => `Job: ${failure.gate}${failure.step ? ` / ${failure.step}` : ''}\n  - ${failure.code}: ${failure.line}`)
      .join('\n\n');
  return {
    failures,
    groups,
    report,
    codes: groups.map((group) => group.code),
    primary: failures[0] ?? { code: 'ERR-0000', line: 'Kein Fehlercode im Gate-Log gefunden', failedTest: null, level: 'AGENT' },
  };
}
