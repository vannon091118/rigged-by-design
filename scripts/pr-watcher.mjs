#!/usr/bin/env node
/**
 * PR Watcher – erstellt Issues bei rotem Gate, Timeout oder Abbruch und
 * schliesst erledigte Issues, wenn `main` gruen ist.
 *
 * Der PR-Body wird im Plan-Job geprueft, nicht hier: ein fehlender Body ist
 * ein Gate-Fehler am PR und keine zweite Issue-Wahrheit. Der Watcher laeuft
 * ausschliesslich auf `workflow_run`.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { diagnose } from './lib/gate-diagnostics.mjs';
import { fingerprintOf, issueBody, scopeLabel } from './lib/issue-scope.mjs';
import { isSupersededRun } from './lib/ci-state.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const GH_TOKEN = process.env.GH_TOKEN;
const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const FINGERPRINT_MARKER = /<!--\s*fp:[^>]+-->/i;
const REPAIR_MARKER = /<!--\s*repair:\s*([0-9a-f]{40})\s*-->/i;

function api(method, path, body) {
  const url = `https://api.github.com/repos/${REPO}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'rbd-pr-watcher',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

/**
 * Eine paginierte Liste. Ein einzelner 100er-Block ist keine Suche: gerade
 * alte Issues mit stabilem Fingerprint liegen sonst hinter der Grenze.
 */
async function listPages(path, request = api) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const res = await request('GET', `${path}${separator}per_page=100&page=${page}`);
    if (!res.ok) return null;
    const batch = await res.json();
    if (!Array.isArray(batch)) return null;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/** Einzige Issue-Suche: Fingerprint zuerst, sonst Titel unter offenen Issues. */
async function findIssue(fingerprint, title, label = 'gate-failure', request = api) {
  const issues = await listPages(`/issues?state=all&labels=${encodeURIComponent(label)}`, request);
  if (!issues) return undefined;
  const byFingerprint = issues.find((issue) => (issue.body ?? '').includes(`<!-- ${fingerprint} -->`));
  if (byFingerprint) return { issue: byFingerprint, recurring: true };
  const byTitle = issues.find((issue) => issue.state === 'open' && issue.title === title);
  return byTitle ? { issue: byTitle, recurring: false } : undefined;
}

/** Zaehlt Vorkommen ueber den Kommentarvertrag und haengt den neuen Lauf an. */
async function recordRecurrence(issue, runUrl, { api: request = api } = {}) {
  const comments = (await listPages(`/issues/${issue.number}/comments`, request)) ?? [];
  const counts = comments.map((comment) => /Vorgekommen: (\d+) mal/.exec(comment.body ?? '')).filter(Boolean);
  const previous = counts.length > 0 ? Math.max(...counts.map((match) => Number(match[1]))) : 1;
  const count = previous + 1;
  if (issue.state === 'closed') {
    const reopened = await request('PATCH', `/issues/${issue.number}`, {
      state: 'open',
      state_reason: 'reopened',
    });
    if (!reopened.ok) {
      console.error(`Issue #${issue.number} konnte nicht wieder geoeffnet werden (${reopened.status}).`);
      return;
    }
    console.log(`Issue #${issue.number} wieder geoeffnet (${count} mal).`);
  }
  await request('POST', `/issues/${issue.number}/comments`, {
    body: `Vorgekommen: ${count} mal, zuletzt ${runUrl}`,
  });
  if (issue.state !== 'closed') console.log(`Issue #${issue.number} aktualisiert (${count} mal).`);
}

/** Dedupliziertes Issue; derselbe Fingerprint wird kommentiert bzw. wieder geoeffnet. */
export async function ensureIssue({
  title,
  body,
  labels,
  fingerprint,
  runUrl,
  label = 'gate-failure',
  api: request = api,
}) {
  const found = await findIssue(fingerprint, title, label, request);
  if (found?.recurring) {
    await recordRecurrence(found.issue, runUrl, { api: request });
    return found.issue;
  }
  if (found) {
    console.log(`Issue existiert bereits: #${found.issue.number}`);
    return found.issue;
  }
  const res = await request('POST', '/issues', {
    title,
    body: `${body}\n<!-- ${fingerprint} -->\n`,
    labels,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Issue-Erstellung fehlgeschlagen: ${res.status} ${err}`);
    process.exit(1);
  }
  const issue = await res.json();
  console.log(`Issue erstellt: #${issue.number} ${issue.html_url}`);
  return issue;
}

async function createIssue(title, body, labels, fingerprint, runUrl, label = 'gate-failure') {
  return ensureIssue({ title, body, labels, fingerprint, runUrl, label });
}

async function ensureLabel(name) {
  if (!name) return;
  await api('POST', '/labels', { name, color: '0e8a16', description: `Gate-Scope ${name}` });
}

async function getWorkflowRunJobs(runId) {
  const res = await api('GET', `/actions/runs/${runId}/jobs`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.jobs ?? [];
}

async function jobLogs(runId) {
  const jobs = await getWorkflowRunJobs(runId);
  const logs = new Map();
  for (const job of jobs.filter((entry) => entry.conclusion === 'failure')) {
    const res = await api('GET', `/actions/jobs/${job.id}/logs`);
    if (res.ok) logs.set(job.id, await res.text());
  }
  return { jobs, logs };
}

async function collectRunFailure(runId) {
  const { jobs, logs } = await jobLogs(runId);
  return diagnose({ jobs, logs });
}

async function runAttempt(runId) {
  const res = await api('GET', `/actions/runs/${runId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return Number(data.run_attempt ?? 1);
}

async function runsForHead(branch, headSha) {
  const res = await api(
    'GET',
    `/actions/runs?branch=${encodeURIComponent(branch)}&head_sha=${encodeURIComponent(headSha)}&per_page=20`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.workflow_runs ?? []).filter((run) => run.name === 'CI Verify');
}

async function createRemoteCiIssue({ runId, runUrl, runBranch, runCommit, conclusion }) {
  const title = `[REMOTE_CI] CI Verify ${conclusion}: ${runBranch}`;
  const fingerprint = fingerprintOf('REMOTE_CI', `${conclusion}:${runBranch}`);
  const body = issueBody({
    branch: runBranch,
    headSha: runCommit,
    gate: 'CI Verify',
    code: 'REMOTE_CI',
    fingerprint,
    state: conclusion,
    runUrl,
    report: `Der Lauf endete mit ${conclusion}. Das ist REMOTE_CI (ERR-4014/ERR-4016): Lauf erneut starten. Kein BLOCKED, kein Dump auf integration.`,
  });
  await createIssue(title, body, ['remote-ci'], fingerprint, runUrl, 'remote-ci');
  console.log(`REMOTE_CI: ${conclusion} (${runId}) – kein Blocker.`);
}

/**
 * `main` ist gruen: Issues schliessen, deren Commit nachweislich auf dem
 * exakten, erfolgreich geprueften Main-Commit liegt. `origin/main` allein
 * reicht nicht: dort kann inzwischen ein neuer, noch ungepruefter Commit sein.
 */
async function sweepGreenMain({ api: request = api, git = defaultGit, mainSha = process.env.MAIN_SHA ?? '' } = {}) {
  if (!/^[0-9a-f]{40}$/.test(mainSha)) {
    console.log('Sweep uebersprungen: kein exakter gruener Main-SHA.');
    return;
  }
  let originMain;
  try {
    originMain = git(['rev-parse', 'origin/main']);
  } catch {
    console.log('Sweep uebersprungen: origin/main nicht lesbar.');
    return;
  }
  if (originMain !== mainSha) {
    console.log(`Sweep uebersprungen: origin/main ${originMain.slice(0, 7)} ist nicht der gepruefte ${mainSha.slice(0, 7)}.`);
    return;
  }
  const issues = await listPages('/issues?state=open&labels=gate-failure', request);
  if (!issues) {
    console.log('Sweep uebersprungen: Issues nicht lesbar.');
    return;
  }
  let closed = 0;
  for (const issue of issues) {
    const body = issue.body ?? '';
    const match = /\*\*(?:Head-SHA|Commit):\*\*\s*`([0-9a-f]{7,40})`/.exec(body);
    const repair = REPAIR_MARKER.exec(body)?.[1] ?? null;
    if (!match || !FINGERPRINT_MARKER.test(body) || !repair || repair === match[1]) continue;
    try {
      git(['merge-base', '--is-ancestor', match[1], mainSha]);
      git(['merge-base', '--is-ancestor', match[1], repair]);
      git(['merge-base', '--is-ancestor', repair, mainSha]);
    } catch {
      continue;
    }
    await request('POST', `/issues/${issue.number}/comments`, {
      body: `Urspruenglicher Befund \`${match[1]}\`, Reparatur \`${repair}\`: beide liegen auf \`${mainSha}\`; \`CI Verify\` ist fuer genau diesen Commit gruen. Issue wird geschlossen.`,
    });
    const patch = await request('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    if (patch.ok) {
      closed += 1;
      console.log(`Issue #${issue.number} geschlossen (gruen auf main).`);
    } else {
      console.error(`Issue #${issue.number} konnte nicht geschlossen werden (${patch.status}).`);
    }
  }
  console.log(`Sweep: ${closed} Issue(s) geschlossen.`);
}

async function handleWorkflowRun() {
  const runId = process.env.RUN_ID;
  const runUrl = process.env.RUN_URL;
  const runBranch = process.env.RUN_BRANCH;
  const runCommit = process.env.RUN_COMMIT;
  const runConclusion = process.env.RUN_CONCLUSION;

  if (runConclusion === 'cancelled') {
    const runs = await runsForHead(runBranch, runCommit);
    if (isSupersededRun({ id: runId, head_sha: runCommit }, runs)) {
      console.log('SUPERSEDED: ein neuerer CI-Lauf ist die Autoritaet; kein Issue.');
      return;
    }
    await createRemoteCiIssue({ runId, runUrl, runBranch, runCommit, conclusion: runConclusion });
    return;
  }
  if (['timed_out', 'startup_failure'].includes(runConclusion)) {
    await createRemoteCiIssue({ runId, runUrl, runBranch, runCommit, conclusion: runConclusion });
    return;
  }
  if (runConclusion !== 'failure') {
    console.log('CI-Run nicht rot, kein Issue noetig.');
    return;
  }

  console.log(`CI-Run rot: ${runBranch} (${runCommit}), Run ${runId}`);
  if (process.env.RBD_AUTO_RESOLVE === '1') {
    console.log('Auto-Resolve uebernimmt Reparatur und Eskalation; pr-watcher legt kein Gate-Issue an.');
    return;
  }

  const diagnostics = await collectRunFailure(runId);
  // ERR-4030 gehoert dem governance-issue-Job; eine zweite Issue-Wahrheit
  // wuerde den Freeze-Befund nur verwischen.
  const findings = (diagnostics.failures ?? []).filter(
    (failure) => failure?.code && failure.code !== 'ERR-4030',
  );
  if (findings.length === 0) {
    console.log('Kein Issue: nur ERR-4030 oder kein Befund; governance-issue ist zustaendig.');
    return;
  }

  const scope = scopeLabel(runBranch);
  await ensureLabel(scope);
  const attempt = await runAttempt(runId);
  const transient = findings.every((failure) => failure.level === 'REMOTE_CI');
  if (transient && attempt !== null && attempt < 2) {
    const rerun = await api('POST', `/actions/runs/${runId}/rerun`, { enable_debug_logging: false });
    console.log(`Retry ${attempt + 1}/2 fuer ausschliesslich transiente Befunde (${rerun.status}).`);
    if (rerun.ok) return;
  }

  for (const failure of findings) {
    const code = failure.code;
    const firstLine = String(failure.line ?? failure.step ?? 'Befund').trim();
    const fingerprint = fingerprintOf(code, firstLine);
    const title = `[${code}] CI Verify: ${firstLine.slice(0, 80)}`;
    const body = issueBody({
      branch: runBranch,
      headSha: runCommit,
      gate: failure.step ?? failure.gate ?? null,
      code,
      fingerprint,
      state: transient ? 'REMOTE_CI' : null,
      runUrl,
      report: failure.line ?? diagnostics.report,
    });
    const labels = transient ? ['remote-ci'] : ['gate-failure', 'agent-action', ...(scope ? [scope] : [])];
    await createIssue(title, body, labels, fingerprint, runUrl, transient ? 'remote-ci' : 'gate-failure');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--sweep-green')) {
    await sweepGreenMain();
    return;
  }
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    await handleWorkflowRun();
  } else {
    console.log(`Unbekanntes Event: ${process.env.GITHUB_EVENT_NAME ?? '(leer)'}`);
  }
}

export { recordRecurrence, sweepGreenMain };
export { fingerprintOf };

const entrypoint = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (entrypoint) {
  main().catch((err) => {
    console.error('pr-watcher Fehler:', err);
    process.exit(1);
  });
}
