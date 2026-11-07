#!/usr/bin/env node
/** Read-only task intake: verify ownership, relevant GitHub work, and local handoff state. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from './lib/error-codes.mjs';
import { loadClaimsStrict, findCollisions } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const blockers = [];
const notes = [];

function command(file, args) {
  try {
    return execFileSync(file, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 }).trim();
  } catch {
    return null;
  }
}

const git = (args) => command('git', args);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unknown)';
const mainFetch = command('git', ['fetch', '--no-tags', 'origin', 'main']);
const claims = loadClaimsStrict();
const claim = claims.find((entry) => entry.branch === branch
  && ['open', 'active', 'sync-pending'].includes(entry.status)
  && !['parked', 'merged', 'archive', 'reserved'].includes(entry.branchStatus));

async function api(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'rigged-by-design-pretask' };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}

async function listIssues() {
  const viaGh = command('gh', ['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,body,url,labels,updatedAt']);
  if (viaGh !== null) return { issues: JSON.parse(viaGh), source: 'gh' };
  const rows = await api('/issues?state=open&per_page=100');
  return {
    source: 'GitHub REST API',
    issues: rows.filter((row) => !row.pull_request).map((row) => ({
      number: row.number,
      title: row.title,
      body: row.body ?? '',
      url: row.html_url,
      updatedAt: row.updated_at,
      labels: (row.labels ?? []).map((label) => ({ name: label.name })),
    })),
  };
}

async function listPullRequests() {
  const viaGh = command('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url,baseRefName,headRefOid,mergeStateStatus']);
  if (viaGh !== null) return { prs: JSON.parse(viaGh), source: 'gh' };
  const rows = await api(`/pulls?state=open&head=${encodeURIComponent(REPO.split('/')[0] + ':' + branch)}&per_page=20`);
  return {
    source: 'GitHub REST API',
    prs: rows.map((row) => ({ number: row.number, url: row.html_url, baseRefName: row.base.ref, headRefOid: row.head.sha, mergeStateStatus: row.mergeable_state })),
  };
}

function labelNames(issue) {
  return (issue.labels ?? []).map((label) => typeof label === 'string' ? label : label.name).filter(Boolean);
}

function issueMatchesLane(issue) {
  if (!claim) return false;
  const labels = labelNames(issue);
  const body = `${issue.title ?? ''}\n${issue.body ?? ''}`;
  return labels.includes(`lane:${claim.id}`)
    || body.includes(`\`${branch}\``)
    || body.includes(`\`${claim.id}\``)
    || body.includes(branch)
    || body.includes(claim.id);
}

function issueIsCritical(issue) {
  const labels = labelNames(issue).map((label) => label.toLowerCase());
  const body = `${issue.title ?? ''}\n${issue.body ?? ''}`;
  const code = /\b(ERR-\d{4})\b/.exec(body)?.[1];
  const definition = code ? CATALOG.get(code) : null;
  if (labels.includes('critical')) return true;
  if (!definition || definition.level !== 'BLOCKED') return false;
  if (definition.scope === 'global') return true;
  return definition.scope === 'lane' && issueMatchesLane(issue);
}

async function main() {
  for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
    const path = git(['rev-parse', '--git-path', marker]);
    if (path && existsSync(join(ROOT, path))) blockers.push(`laufender ${marker.replace(/-/g, ' ')}: erst abschliessen oder abbrechen`);
  }

  const unmerged = git(['diff', '--name-only', '--diff-filter=U']);
  if (unmerged) blockers.push(`unmerged Pfade: ${unmerged.split(/\r?\n/).join(', ')}`);
  const conflictMarkers = git(['grep', '-n', '-E', '^(<<<<<<<|>>>>>>>) ', '--', '.']);
  if (conflictMarkers) blockers.push(`Konfliktmarker im Baum: ${conflictMarkers.split(/\r?\n/).slice(0, 8).join('; ')}`);

  console.log(`pretask: Branch ${branch}`);
  console.log(`pretask: Worktree ${git(['rev-parse', '--show-toplevel']) ?? '(nicht feststellbar)'}`);
  if (branch === 'main') {
    notes.push('main ist PR-Ziel; fuer Schreibarbeit auf eine Lane wechseln.');
  } else if (!claim) {
    blockers.push(`kein aktiver Lane-Claim fuer '${branch}' in .lane-claims/claims.json`);
  } else {
    notes.push(`Lane ${claim.id} · Owner ${claim.owner} · ${claim.pathAllowlist.length} erlaubte Pfade.`);
    if (claim.branchStatus === 'closing') notes.push('Abschluss-Lane: bestehender WIP wird synchronisiert und geprueft; keine neuen Pfade hinzufuegen.');
    if (claim.workerId && process.env.RBD_AGENT_ID && claim.workerId !== process.env.RBD_AGENT_ID) {
      blockers.push(`Lane-Owner-Konflikt: Claim gehoert ${claim.workerId}, Laufzeit meldet ${process.env.RBD_AGENT_ID}`);
    }
    if (claim.branchStatus === 'sync-pending' || claim.status === 'sync-pending') {
      blockers.push(`Handoff offen: ${claim.handoff?.summary ?? claim.syncNote ?? 'Main-Sync wartet auf Konfliktloesung'}`);
    }
    if (mainFetch === null) notes.push('origin/main konnte nicht aktualisiert werden; Rueckstand ist nur gegen den letzten lokalen Remote-Stand geprueft.');
    const collisions = findCollisions(claim);
    if (collisions.length > 0) blockers.push(`Lane-Kollision: ${collisions.map((entry) => entry.lane).join(', ')}`);
    const counts = (git(['rev-list', '--left-right', '--count', 'origin/main...HEAD']) ?? '').split(/\s+/).map(Number);
    if (counts.length === 2 && Number.isFinite(counts[0]) && Number.isFinite(counts[1]) && counts[0] > 0) {
      notes.push(`${counts[0]} Commit(s) hinter origin/main; Main vor der Implementierung einziehen und einen Konflikt hier loesen.`);
    }
  }

  const stashes = git(['stash', 'list']);
  if (stashes) notes.push(`${stashes.split(/\r?\n/).length} vorhandene Stash(es), unveraendert.`);

  console.log('');
  console.log('=== Relevante offene Issues ===');
  try {
    const { issues, source } = await listIssues();
    console.log(`Issue-Quelle: ${source}; ${issues.length} offene(s) Issue(s) gelesen.`);
    const relevant = issues.filter(issueMatchesLane);
    const gateFailures = issues.filter((issue) => labelNames(issue).includes('gate-failure'));
    const remoteCi = issues.filter((issue) => labelNames(issue).includes('remote-ci'));
    const priority = [...new Map([...relevant, ...gateFailures.filter(issueIsCritical)].map((issue) => [issue.number, issue])).values()];
    if (priority.length === 0) console.log('  Keine offenen Issues fuer diese Lane. Fremde Lane-Issues blockieren diesen Task nicht.');
    for (const issue of priority) {
      const scope = issueMatchesLane(issue) ? claim?.id ?? branch : 'global/critical';
      console.log(`  #${issue.number} ${issue.title} · ${scope} · ${issue.url}`);
      if (issueIsCritical(issue) && (!claim || issueMatchesLane(issue))) blockers.push(`kritischer Befund #${issue.number} betrifft ${scope}`);
    }
    if (gateFailures.length > 0) notes.push(`${gateFailures.length} offene gate-failure-Issue(s) gelesen; nur lane-relevante kritische Befunde blockieren.`);
    if (remoteCi.length > 0) notes.push(`${remoteCi.length} offene remote-ci-Issue(s) gelesen; Wiederholung/Runner-Ausfall blockiert nicht.`);
  } catch (error) {
    console.log(`Issue-Check NICHT erfolgt: ${error instanceof Error ? error.message : String(error)}`);
    notes.push('GitHub-Issues konnten nicht gelesen werden; kein Issue-Status wird behauptet.');
  }

  console.log('');
  console.log('=== Branch / PR ===');
  try {
    const { prs, source } = await listPullRequests();
    console.log(`PR-Quelle: ${source}; ${prs.length} offene(r) PR(s) fuer diesen Branch.`);
    for (const pr of prs) console.log(`  #${pr.number} base=${pr.baseRefName} head=${pr.headRefOid} merge=${pr.mergeStateStatus} · ${pr.url}`);
  } catch (error) {
    console.log(`PR-Status NICHT gelesen: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const note of notes) console.log(`pretask: ${note}`);
  if (blockers.length > 0) {
    console.error('');
    console.error('pretask: STARTBLOCKER - zuerst diesen Branch/Handoff bearbeiten:');
    for (const blocker of blockers) console.error(`  - ${blocker}`);
    process.exit(1);
  }
  console.log('');
  console.log('pretask: lane-relevante Startpruefung abgeschlossen; nicht-kritische und fremde Issues blockieren nicht.');
}

main().catch((error) => {
  console.error(`pretask: Issue-/Branch-Pruefung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
