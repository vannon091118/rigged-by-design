#!/usr/bin/env node
/** Synchronize active owned branches by merging main, never by rebasing or force-pushing. */
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadClaimsStrict } from './lib/lane-claims.mjs';
import { syncRemoteBranch } from './lib/branch-sync.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const labels = ['integration/konflikt', 'blocked', 'agent-action'];
const allowedStatus = new Set(['open', 'active', 'sync-pending']);
const oneBranch = process.argv.find((arg) => arg.startsWith('--branch='))?.slice('--branch='.length);

async function api(method, path, body) {
  if (!TOKEN) throw new Error('GH_TOKEN/GITHUB_TOKEN fehlt; Sync-Issue kann nicht geroutet werden.');
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'rigged-by-design-branch-sync' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.status === 204 ? null : response.json();
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function mergedPullRequest(branch) {
  const owner = REPO.split('/')[0];
  const pulls = await api('GET', `/pulls?state=closed&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=50`);
  return pulls.find((pull) => pull.merged_at) ?? null;
}

async function dependenciesReady(claim, allClaims) {
  for (const dependencyId of claim.dependencies ?? []) {
    const dependency = allClaims.find((entry) => entry.id === dependencyId);
    if (!dependency) return false;
    if (dependency.status === 'merged' || dependency.branchStatus === 'merged') continue;
    if (!await mergedPullRequest(dependency.branch)) return false;
  }
  return true;
}

async function issueFor(claim, result) {
  const title = `[SYNC-CONFLICT] ${claim.branch} braucht Main-Sync`;
  const detail = result.status === 'conflict'
    ? `Konfliktdateien: ${result.conflicts.join(', ') || 'nicht eindeutig'}.`
    : 'Der normale Fast-Forward-Push wurde abgelehnt; Remote-Head pruefen und Merge-Sync wiederholen.';
  const fingerprint = `<!-- lane-sync:${claim.branch}:${result.mainSha ?? 'unknown'} -->`;
  const body = `## Main-Sync wartet auf den Lane-Owner

**Lane:** \`${claim.id}\`  
**Branch:** \`${claim.branch}\`  
**Owner:** \`${claim.owner}\`  
**Main-SHA:** \`${result.mainSha ?? 'unbekannt'}\`  
**Branch-SHA vor Sync:** \`${result.branchSha ?? 'unbekannt'}\`  
**Befund:** ${detail}

Der Sync-Worker hat in einem isolierten Worktree versucht, \`main\` normal in diesen Branch zu mergen. Er hat den Remote-WIP nicht ueberschrieben. Nur diese Lane wartet; andere Branches liefen weiter.

Loesung: den Konflikt auf \`${claim.branch}\` aufloesen, den Merge committen und pushen. Danach verschwindet der Befund beim naechsten erfolgreichen Main-Sync.

${fingerprint}
`;
  for (const label of [...labels, `lane:${claim.id}`]) {
    try {
      await api('POST', '/labels', { name: label, color: label === 'blocked' ? 'b60205' : 'd93f0b', description: `Lane-Sync ${label}` });
    } catch {
      // 422 means the label already exists; issue creation reports genuine errors.
    }
  }
  const open = await api('GET', '/issues?state=open&labels=integration%2Fkonflikt&per_page=100');
  const existing = open.find((issue) => issue.title === title);
  if (existing) {
    await api('POST', `/issues/${existing.number}/comments`, { body: `Neuer Sync-Versuch mit main ${result.mainSha ?? 'unbekannt'}.\n\n${detail}` });
    await api('PATCH', `/issues/${existing.number}`, { body: `${body}\n<!-- lane-sync:${claim.branch}:${result.mainSha ?? 'unknown'} -->` });
    return `Issue #${existing.number} aktualisiert`;
  }
  const issue = await api('POST', '/issues', { title, body, labels: [...labels, `lane:${claim.id}`] });
  return `Issue #${issue.number} erstellt`;
}

async function dispatchPrAndCi(branch) {
  if (!TOKEN) return 'Workflow-Dispatch uebersprungen (kein Token)';
  try {
    execFileSync('gh', ['workflow', 'run', 'pr-escalation.yml', '--ref', 'main', '--field', `branch=${branch}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GH_TOKEN: TOKEN },
    });
    return 'PR-Erstellung/Body-Update dispatcht';
  } catch {
    return 'PR-Workflow-Dispatch fehlgeschlagen; Push bleibt erhalten';
  }
}

async function main() {
  const all = loadClaimsStrict();
  const claims = all.filter((claim) => allowedStatus.has(claim.status)
    && ['active', 'closing'].includes(claim.branchStatus ?? (claim.status === 'open' ? 'active' : claim.status))
    && claim.branch !== 'main' && claim.branch !== 'integration'
    && (!oneBranch || claim.branch === oneBranch));
  const rows = [];

  for (const claim of claims) {
    if (!await dependenciesReady(claim, all)) {
      rows.push(`${claim.branch}: wartet auf Lane-Abhaengigkeiten`);
      continue;
    }
    const merged = await mergedPullRequest(claim.branch).catch(() => null);
    if (merged) {
      rows.push(`${claim.branch}: merged PR #${merged.number}, remote cleanup owns branch deletion`);
      continue;
    }

    const fetched = git(['fetch', 'origin', `+refs/heads/${claim.branch}:refs/remotes/origin/${claim.branch}`]);
    if (fetched === null) {
      rows.push(`${claim.branch}: remote branch missing; claim retained for review`);
      continue;
    }
    const sameTree = git(['diff', '--quiet', 'origin/main', `origin/${claim.branch}`]);
    if (sameTree !== null) {
      rows.push(`${claim.branch}: tree already matches main`);
      continue;
    }

    let result = syncRemoteBranch(claim.branch);
    if (result.status === 'push-rejected') result = syncRemoteBranch(claim.branch);
    if (result.status === 'synced' || result.status === 'current') {
      const followup = result.status === 'synced' ? await dispatchPrAndCi(claim.branch) : 'bereits aktuell';
      rows.push(`${claim.branch}: ${result.status} ${result.branchSha ?? ''} · ${followup}`);
      continue;
    }
    if (result.status === 'conflict' || result.status === 'push-rejected') {
      const issue = await issueFor(claim, result);
      rows.push(`${claim.branch}: ${result.status} · ${issue}`);
      continue;
    }
    rows.push(`${claim.branch}: ${result.status} · ${result.detail ?? 'nicht veraendert'}`);
  }

  const report = ['# Main branch synchronization', '', ...rows.map((row) => `- ${row}`), ''].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  if (rows.some((row) => row.includes('Issue nicht'))) process.exit(1);
}

main().catch((error) => {
  console.error(`sync-lanes: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
