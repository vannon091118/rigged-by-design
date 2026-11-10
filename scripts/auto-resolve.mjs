#!/usr/bin/env node
/**
 * Auto-Resolve: ein roter CI-Lauf wird eingeordnet, bevor ein Issue entsteht.
 *
 * Reihenfolge:
 *   1. NOOP/PR_HANDOFF und ein nicht lesbarer Befund erzeugen nichts.
 *   2. Ein ausschliesslich transienter Befund wird genau einmal wiederholt.
 *   3. Ein mechanischer Befund wird in einem temporaeren Worktree repariert -
 *      nie im Agenten-Worktree und nie mit Code aus dem Pruefobjekt.
 *   4. Nach der Reparatur laufen nur die betroffenen Gates erneut.
 *   5. Erst dann entsteht ein dedupliziertes Issue.
 *
 * Der Push mit `GITHUB_TOKEN` startet keine Workflows. Deshalb pusht nur ein
 * `AUTOFIX_TOKEN` (PAT/App); ohne ihn wird der verifizierte Patch als Artefakt
 * bereitgestellt und ausdruecklich kein "behoben" behauptet.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagnose } from './lib/gate-diagnostics.mjs';
import {
  AUTOFIX_SCRIPTS,
  filterPaths,
  planResolution,
  repairAttemptAllowed,
} from './lib/repair-plan.mjs';
import { fingerprintOf, issueBody, parseIssueBody, scopeLabel } from './lib/issue-scope.mjs';
import { ensureIssue } from './pr-watcher.mjs';
import { ROOT } from './lib/report.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const GH_TOKEN = process.env.GH_TOKEN;
const WORKTREE = '.rbd-autofix-worktree';
const MAX_ATTEMPTS = 2;
const IDENTITY = { name: 'rbd-autofix', email: 'autofix@users.noreply.github.com' };

const defaultApi = (method, path, body) => {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'rbd-auto-resolve',
    },
  };
  if (body) options.body = JSON.stringify(body);
  return fetch(`https://api.github.com/repos/${REPO}${path}`, options);
};

const defaultGit = (args, options = {}) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();

const defaultExec = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

/** Pfade aus `git status --porcelain`; Renames behalten beide Seiten nicht. */
export function changedPaths(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((entry) => (entry.includes(' -> ') ? entry.split(' -> ').pop() : entry))
    .map((entry) => entry.replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

export function patchPath(sha) {
  return `artifacts/autofix-${String(sha).slice(0, 12)}.patch`;
}

/** Issue-Body fuer einen Befund, der nicht automatisch repariert werden kann. */
export function issueFor(decision, { branch, sha, runUrl, report }) {
  const failure = decision.failure ?? {};
  const fingerprint = failure.fingerprint
    ?? fingerprintOf(failure.code ?? 'ERR-0000', failure.line ?? decision.reason);
  return {
    fingerprint,
    title: `[${failure.code ?? 'ERR-0000'}] CI Verify: ${String(failure.line ?? decision.reason).slice(0, 80)}`,
    body: issueBody({
      branch,
      headSha: sha,
      gate: failure.gate ?? null,
      code: failure.code ?? 'ERR-0000',
      fingerprint,
      state: decision.state,
      runUrl,
      report,
      repair: decision.marker,
    }),
  };
}

/**
 * Repariert in einem temporaeren Worktree. `exec`/`git` sind injizierbar, damit
 * der Ablauf ohne echtes Netz und ohne echten Push pruefbar bleibt.
 */
export function attemptRepair({
  branch,
  sha,
  gates,
  marker,
  controlRoot,
  repo = REPO,
  token = '',
  worktree = WORKTREE,
  git = defaultGit,
  exec = defaultExec,
  log = console.log,
} = {}) {
  const path = resolve(ROOT, worktree);
  const env = { ...process.env, RBD_ROOT: path, RBD_CONTROL_ROOT: controlRoot };
  try {
    rmSync(path, { recursive: true, force: true });
    git(['worktree', 'prune'], { cwd: ROOT });
    // Pruefobjekt ist ein temporaerer Worktree, nie der Agenten-Baum.
    git(['worktree', 'add', '--detach', path, sha], { cwd: ROOT });
    for (const script of AUTOFIX_SCRIPTS) {
      log(`autofix: ${script}`);
      exec(process.execPath, [join(controlRoot, script)], { cwd: path, env });
    }
    const changed = changedPaths(git(['status', '--porcelain'], { cwd: path }));
    const scope = filterPaths(changed);
    if (!scope.ok) {
      return { ok: false, reason: `Pfade ausserhalb der Allowlist: ${scope.foreign.join(', ')}` };
    }
    if (changed.length === 0) {
      return { ok: false, reason: 'keine mechanische Aenderung; der Befund braucht einen Agenten' };
    }
    for (const gate of gates) {
      log(`autofix: Gate ${gate} erneut`);
      exec(
        process.execPath,
        [join(controlRoot, 'scripts', 'run-pipeline.mjs'), '--profile=full', `--gate=${gate}`],
        { cwd: path, env },
      );
    }
    const message = [
      'chore(autofix): mechanische Doku- und Generat-Pfade',
      '',
      '### Changes (Was ist neu)',
      `- Automatisch nachgezogen: ${scope.allowed.join(', ')}.`,
      '',
      '### Technische Basis & Kausalität',
      '- Roter Gate-Befund auf mechanischen, abgeleiteten Pfaden; keine Produktlogik geaendert.',
      '',
      '### Ausblick (Nächste Schritte)',
      '- Betroffene Gates wurden erneut ausgefuehrt; die CI prueft den neuen Stand.',
      '',
      marker,
    ].join('\n');
    git(['add', '-A'], { cwd: path });
    git(['-c', `user.name=${IDENTITY.name}`, '-c', `user.email=${IDENTITY.email}`, 'commit', '-F', '-'], {
      cwd: path,
      input: `${message}\n`,
    });
    if (token) {
      const url = `https://x-access-token:${token}@github.com/${repo}.git`;
      git(['push', url, `HEAD:${branch}`], { cwd: path });
      return { ok: true, pushed: true, paths: scope.allowed, sha: git(['rev-parse', 'HEAD'], { cwd: path }) };
    }
    // Ohne PAT startet ein Push mit GITHUB_TOKEN keine Workflows. Dann lieber
    // ein ehrlicher Patch als ein stiller "behoben"-Zustand.
    const patch = git(['format-patch', '-1', '--stdout'], { cwd: path });
    mkdirSync(join(ROOT, 'artifacts'), { recursive: true });
    writeFileSync(join(ROOT, patchPath(sha)), patch);
    return { ok: true, pushed: false, paths: scope.allowed, patch: patchPath(sha) };
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error).slice(0, 240) };
  } finally {
    try {
      git(['worktree', 'remove', '--force', path], { cwd: ROOT });
    } catch {
      rmSync(path, { recursive: true, force: true });
    }
  }
}

async function readRun(runId, api) {
  const res = await api('GET', `/actions/runs/${runId}/jobs`);
  const jobs = res.ok ? (await res.json()).jobs ?? [] : [];
  const logs = new Map();
  for (const job of jobs.filter((entry) => entry.conclusion === 'failure')) {
    const log = await api('GET', `/actions/jobs/${job.id}/logs`);
    if (log.ok) logs.set(job.id, await log.text());
  }
  return diagnose({ jobs, logs });
}

async function ensureLabel(name, api) {
  if (!name) return;
  await api('POST', '/labels', { name, color: '0e8a16', description: `Gate-Scope ${name}` });
}

async function existingIssue(fingerprint, api) {
  for (let page = 1; page <= 20; page += 1) {
    const res = await api('GET', `/issues?state=all&labels=gate-failure&per_page=100&page=${page}`);
    if (!res.ok) return null;
    const issues = await res.json();
    if (!Array.isArray(issues)) return null;
    const hit = issues.find((issue) => (issue.body ?? '').includes(`<!-- ${fingerprint} -->`));
    if (hit) return hit;
    if (issues.length < 100) break;
  }
  return null;
}

export async function autoResolve({ env = process.env, api = defaultApi, git = defaultGit, exec = defaultExec, log = console.log } = {}) {
  const runId = env.RUN_ID;
  const runUrl = env.RUN_URL ?? '';
  const branch = env.RUN_BRANCH ?? '';
  const sha = env.RUN_COMMIT ?? '';
  const state = env.CI_STATE ?? null;
  const conclusion = env.RUN_CONCLUSION ?? 'failure';
  const attempts = Number(env.RUN_ATTEMPT ?? 1);
  const sameRepo = env.RUN_SAME_REPO !== 'false';
  const fork = env.RUN_FORK === 'true';

  if (!runId) {
    log('auto-resolve: kein RUN_ID, nichts zu tun');
    return 0;
  }
  const diagnostics = await readRun(runId, api);
  // ERR-4030 gehoert ausschliesslich dem governance-issue-Job.
  const failures = (diagnostics.failures ?? []).filter(
    (failure) => failure?.code && failure.code !== 'ERR-4030',
  );
  if (failures.length === 0) {
    log('auto-resolve: kein Befund ausserhalb von ERR-4030; nichts zu tun');
    return 0;
  }
  const primary = failures[0];
  const fingerprint = fingerprintOf(primary.code, primary.line);
  const known = await existingIssue(fingerprint, api);
  const body = known?.body ?? '';

  const decision = planResolution({
    state,
    conclusion,
    failures,
    branch,
    sameRepo,
    fork,
    body,
    sha,
    attempts,
  });
  // Der Repair-Marker aus dem Issue-Body blockiert den zweiten Versuch; der
  // Autofix-Marker im Body dokumentiert den ersten.
  const attempted = parseIssueBody(body).autofix;
  const repairAllowed = decision.action === 'repair'
    && repairAttemptAllowed({ body, sha, attempts })
    && (!attempted || attempted !== sha);
  log(`auto-resolve: ${decision.action} - ${decision.reason}`);

  if (decision.action === 'none') return 0;
  if (decision.action === 'rerun') {
    if (attempts >= MAX_ATTEMPTS) {
      log('auto-resolve: REMOTE_CI bleibt REMOTE_CI; kein Gate-Issue, keine Lane-Blockade');
      return 0;
    }
    const res = await api('POST', `/actions/runs/${runId}/rerun`, { enable_debug_logging: false });
    log(`auto-resolve: Wiederholung ${res.status === 201 || res.ok ? 'gestartet' : `fehlgeschlagen (${res.status})`}`);
    return 0;
  }
  if (decision.action === 'repair' && repairAllowed) {
    const result = attemptRepair({
      branch,
      sha,
      gates: decision.gates,
      marker: decision.marker,
      controlRoot: env.RBD_CONTROL_ROOT ?? ROOT,
      token: env.AUTOFIX_TOKEN ?? '',
      git,
      exec,
      log,
    });
    if (result.ok) {
      log(result.pushed
        ? `auto-resolve: repariert und gepusht (${result.paths.join(', ')})`
        : `auto-resolve: Patch bereitgestellt (${result.patch}); kein Push ohne AUTOFIX_TOKEN`);
      return 0;
    }
    log(`auto-resolve: Reparatur nicht moeglich - ${result.reason}`);
    await ensureLabel(scopeLabel(branch), api);
    for (const failure of failures) {
      const issue = issueFor({ ...decision, failure }, { branch, sha, runUrl, report: diagnostics.report });
      await ensureIssue({
        title: issue.title,
        body: `${issue.body}\nReparaturversuch: ${result.reason}\n`,
        labels: ['gate-failure', 'agent-action', ...(scopeLabel(branch) ? [scopeLabel(branch)] : [])],
        fingerprint: issue.fingerprint,
        runUrl,
        api,
      });
    }
    return 0;
  }

  await ensureLabel(scopeLabel(branch), api);
  for (const failure of failures) {
    const issue = issueFor({ ...decision, failure }, { branch, sha, runUrl, report: diagnostics.report });
    await ensureIssue({
      title: issue.title,
      body: issue.body,
      labels: ['gate-failure', 'agent-action', ...(scopeLabel(branch) ? [scopeLabel(branch)] : [])],
      fingerprint: issue.fingerprint,
      runUrl,
      api,
    });
  }
  return 0;
}

const entrypoint = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (entrypoint) {
  autoResolve()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('auto-resolve Fehler:', error);
      process.exit(1);
    });
}
