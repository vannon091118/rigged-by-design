#!/usr/bin/env node
/**
 * Lange Nachweise ueber GitHub Actions statt auf der eigenen Maschine.
 *
 * Statistik, Soak, Balance und Benchmarks brauchen Minuten bis Stunden; die
 * lokale Schleife bleibt bei den schnellen Beweisklassen. Dieses Skript startet
 * `long-checks.yml` auf `main`, wartet auf das Ergebnis und laedt die Artefakte
 * (Balance-Bericht) herunter. Bevorzugt `gh`, sonst die REST-API.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ROOT } from './lib/report.mjs';

const WORKFLOW = 'long-checks.yml';
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const inputs = {
  verify: !argv.includes('--no-verify'),
  soak_ticks: arg('soak-ticks', process.env.RBD_SOAK_TICKS ?? '100000'),
  balance_days: arg('balance-days', process.env.RBD_DAYS ?? '40'),
};
const timeoutMs = Number(arg('timeout-minutes', '90')) * 60_000;
const startedAt = Date.now();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const hasGh = spawnSync('gh', ['--version'], { stdio: 'ignore' }).status === 0;

function gitOutput(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function repoSlug() {
  const remote = gitOutput(['remote', 'get-url', 'origin']);
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(remote);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** Token nur aus der Umgebung oder dem Credential-Helper; nie im Log. */
function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const fill = spawnSync('git', ['credential', 'fill'], {
    cwd: ROOT,
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  return /password=(.+)/.exec(fill.stdout ?? '')?.[1]?.trim() ?? null;
}

async function api(path, auth, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} bei ${path}`);
  return response.status === 204 ? null : response.json();
}

async function waitForRun(load, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await load();
    if (run) return run;
    console.log(`${label}: warte auf den Lauf …`);
    await sleep(10_000);
  }
  return null;
}

async function ghPath() {
  const slug = repoSlug();
  if (!slug) {
    fail(1, 'ERR-4016', 'ci-long', 'kein GitHub-Remote gefunden; gh kann den Lauf nicht adressieren');
    process.exit(1);
  }
  const args = ['workflow', 'run', WORKFLOW, '--ref', 'main'];
  for (const [key, value] of Object.entries(inputs)) args.push('-f', `${key}=${value}`);
  console.log(`ci-long: starte ${slug} ${WORKFLOW} (${JSON.stringify(inputs)})`);
  execFileSync('gh', args, { cwd: ROOT, stdio: 'inherit' });

  const run = await waitForRun(() => {
    const list = JSON.parse(execFileSync('gh', [
      'run', 'list', '--workflow', WORKFLOW, '--limit', '5',
      '--json', 'databaseId,createdAt,status,conclusion,url',
    ], { cwd: ROOT, encoding: 'utf8' }));
    return list.find((entry) => Date.parse(entry.createdAt) >= startedAt - 60_000) ?? null;
  }, 'ci-long');
  if (!run) {
    fail(1, 'ERR-4016', 'ci-long', 'der gestartete Lauf ist nicht auffindbar');
    process.exit(1);
  }

  console.log(`ci-long: verfolge Lauf ${run.url}`);
  const watch = spawnSync('gh', ['run', 'watch', String(run.databaseId), '--exit-status', '--interval', '20'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  const target = join(ROOT, 'artifacts', 'ci', String(run.databaseId));
  mkdirSync(target, { recursive: true });
  const download = spawnSync('gh', ['run', 'download', String(run.databaseId), '-D', target], { cwd: ROOT, stdio: 'inherit' });
  if (download.status === 0) console.log(`ci-long: Artefakte in ${target}`);
  if (watch.status !== 0) {
    fail(1, 'ERR-4016', 'ci-long', `Lauf ${run.url} ist rot; Logs oben und im Browser`);
    process.exit(1);
  }
  console.log(`ci-long: PASS (${run.url})`);
  process.exit(0);
}

async function restPath() {
  const auth = token();
  const slug = repoSlug();
  if (!auth || !slug) {
    fail(1, 'ERR-4016', 'ci-long', 'kein GitHub-Token und kein Remote; GH_TOKEN setzen oder gh installieren');
    process.exit(1);
  }
  await api(`/repos/${slug}/actions/workflows/${WORKFLOW}/dispatches`, auth, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs }),
  });
  console.log(`ci-long: ${slug} ${WORKFLOW} gestartet (${JSON.stringify(inputs)})`);

  const run = await waitForRun(async () => {
    const list = await api(`/repos/${slug}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=10`, auth);
    return (list.workflow_runs ?? []).find((entry) => Date.parse(entry.created_at) >= startedAt - 60_000) ?? null;
  }, 'ci-long');
  if (!run) {
    fail(1, 'ERR-4016', 'ci-long', 'der gestartete Lauf ist nicht auffindbar');
    process.exit(1);
  }

  let current = run;
  const deadline = Date.now() + timeoutMs;
  while (current.status !== 'completed' && Date.now() < deadline) {
    console.log(`ci-long: ${current.status} – ${current.html_url}`);
    await sleep(20_000);
    current = await api(`/repos/${slug}/actions/runs/${run.id}`, auth);
  }
  if (current.status !== 'completed') {
    fail(1, 'ERR-4016', 'ci-long', `Lauf nach ${timeoutMs / 60_000} min nicht fertig: ${run.html_url}`);
    process.exit(1);
  }
  if (current.conclusion !== 'success') {
    const jobs = await api(`/repos/${slug}/actions/runs/${run.id}/jobs`, auth);
    for (const job of jobs.jobs ?? []) {
      for (const step of job.steps ?? []) {
        if (step.conclusion === 'failure') console.error(`ci-long: rot in ${job.name} / ${step.name}`);
      }
    }
    fail(1, 'ERR-4016', 'ci-long', `Lauf ${current.html_url} ist ${current.conclusion}`);
    process.exit(1);
  }
  console.log(`ci-long: PASS (${current.html_url})`);
  console.log('ci-long: Artefakte laedt `gh run download`; ohne gh im Browser am Lauf.');
  process.exit(0);
}

await (hasGh ? ghPath() : restPath());
