/**
 * Quellen der Ursachenanalyse: lokales Log, letzter CI-Lauf, lokaler Bericht
 * und Pipeline-Summary. Keine zweite Diagnose; alles laeuft ueber
 * `gate-diagnostics` und `repair-plan`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { diagnose } from './gate-diagnostics.mjs';
import { GATES } from './pipeline-plan.mjs';
import { gateOf } from './repair-plan.mjs';
import { ROOT } from './report.mjs';
import { reportsDir } from './verify-state.mjs';
import { enrich } from './agent-cause-enrich.mjs';

const git = (list) => {
  try {
    return execFileSync('git', list, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const gh = (list) => {
  try {
    return execFileSync('gh', list, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 25_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

/** Repo-Slug aus dem Remote; kein API-Aufruf noetig. */
export function repoSlug() {
  const remote = git(['remote', 'get-url', 'origin']);
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remote);
  return match ? `${match[1]}/${match[2]}` : '';
}

/** Letzte Pipeline-Summary; `null`, wenn keine existiert. */
function latestSummary() {
  const base = reportsDir({ root: ROOT });
  if (!existsSync(base)) return null;
  const runs = readdirSync(base)
    .map((name) => join(base, name))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  for (const dir of runs) {
    const file = join(dir, 'summary.md');
    if (existsSync(file)) return { dir, text: readFileSync(file, 'utf8') };
  }
  return null;
}

/** Lokale rote Gates aus `agent:verify` (bevorzugt) oder aus der Summary. */
export function localFindings() {
  const agentFile = join(reportsDir({ root: ROOT }), 'agent', 'agent-summary.json');
  if (existsSync(agentFile)) {
    try {
      const report = JSON.parse(readFileSync(agentFile, 'utf8'));
      const failed = Array.isArray(report.failed) ? report.failed : [];
      const open = Array.isArray(report.open) ? report.open : [];
      const known = new Set(failed);
      return [
        ...failed.map((name) => ({ source: 'lokal', gate: name, line: `Gate ${name} fehlgeschlagen`, detail: '' })),
        ...open.filter((entry) => !known.has(entry)).map((entry) => ({ source: 'lokal', gate: null, line: entry, detail: '' })),
      ];
    } catch {
      // Unlesbarer Bericht ist kein Befund; die Summary entscheidet.
    }
  }
  const summary = latestSummary();
  if (!summary) return [];
  return summary.text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*[a-z0-9:_-]+\s*\|/.test(line) && /\|\s*FAIL\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      return { source: 'lokal', gate: cells[0], line: `Gate ${cells[0]} FAIL`, detail: '' };
    });
}

/** Gate-Name aus Step, Logpfad oder Jobname; nur bekannte Gate-Namen. */
function gateNameOf(failure) {
  const fromStep = gateOf(failure);
  if (fromStep && GATES[fromStep]) return fromStep;
  const raw = /pipeline\/([a-z0-9:_-]+):/i.exec(String(failure.line ?? ''))?.[1];
  if (raw) {
    const parts = raw.split(':');
    for (let count = parts.length; count >= 1; count -= 1) {
      const candidate = parts.slice(0, count).join(':');
      if (GATES[candidate]) return candidate;
    }
  }
  const name = String(failure.gate ?? '').replace(/^Gate\s+/i, '').trim();
  return name && GATES[name] ? name : null;
}

/** Befund aus einem heruntergeladenen Gate-Log, ohne Netz und ohne gh. */
export function findingsFromLog(text) {
  const job = { name: 'Log', conclusion: 'failure', steps: [], id: 1 };
  const result = diagnose({ jobs: [job], logs: new Map([[1, text]]) });
  return result.failures.map((failure) => ({
    source: 'log',
    gate: gateNameOf(failure),
    code: failure.code,
    line: failure.line,
    failedTest: failure.failedTest ?? null,
  }));
}

/** Letzter `CI Verify`-Lauf fuer genau diesen HEAD; `null` ohne gh. */
export function ciRunForHead(head, slug) {
  const raw = gh(['run', 'list', '--workflow=CI Verify', '--limit', '20', '--json', 'databaseId,headSha,conclusion,status,url']);
  if (!raw) return { run: null, reason: 'gh nicht verfuegbar oder nicht angemeldet' };
  try {
    const runs = JSON.parse(raw).filter((entry) => entry.headSha === head);
    if (runs.length === 0) return { run: null, reason: `kein CI Verify-Lauf fuer ${head.slice(0, 7)}` };
    runs.sort((left, right) => Number(right.databaseId) - Number(left.databaseId));
    return { run: runs[0], reason: null, slug };
  } catch {
    return { run: null, reason: 'gh-Antwort nicht lesbar' };
  }
}

/** Befunde eines CI-Laufs inklusive vollstaendigem Log je Fehljob. */
export function ciFindings(run, slug) {
  if (!run?.databaseId || !slug) return { findings: [], reason: 'kein Lauf' };
  const jobsRaw = gh(['api', `repos/${slug}/actions/runs/${run.databaseId}/jobs`]);
  if (!jobsRaw) return { findings: [], reason: 'Jobs nicht lesbar' };
  let jobs;
  try {
    jobs = JSON.parse(jobsRaw).jobs ?? [];
  } catch {
    return { findings: [], reason: 'Job-Liste nicht lesbar' };
  }
  const logs = new Map();
  for (const job of jobs.filter((entry) => entry.conclusion === 'failure' || entry.conclusion === 'timed_out')) {
    const text = gh(['api', `repos/${slug}/actions/jobs/${job.id}/logs`]);
    if (text) logs.set(job.id, text);
  }
  const result = diagnose({ jobs, logs });
  return {
    reason: null,
    findings: result.failures.map((failure) => ({
      source: 'ci',
      gate: gateNameOf(failure),
      code: failure.code,
      line: failure.line,
      failedTest: failure.failedTest ?? null,
      url: failure.url ?? run.url ?? null,
    })),
  };
}

/** Befunde eines Logs, angereichert; auch fuer Tests importierbar. */
export function diagnoseLog(text) {
  return findingsFromLog(text).map(enrich);
}

/** Ein Gate ohne Log: Fix und Repro kommen aus demselben Plan wie in der CI. */
export function causeForGate(gate, { source = 'lokal', failedTest = null } = {}) {
  return enrich({ source, gate, code: null, line: `Gate ${gate} fehlgeschlagen`, failedTest });
}

/** Rote Gates aus dem lokalen Verify-Bericht; offene Notizen sind kein Gate. */
export function localCauses() {
  return localFindings().map(enrich).filter((finding) => finding.gate !== null);
}
