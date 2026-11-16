#!/usr/bin/env node
/**
 * merge:queue — der eine Merge-Befehl (#913).
 *
 * Ohne Workflow, ohne Actions: die Queue wird aus den Ereignissen an #913 und
 * den offenen PRs berechnet, veroeffentlicht und bestaetigt. Der Merge selbst
 * ist gesperrt, solange keine bestaetigte Revision existiert; jeder Blocker
 * nennt genau den Befehl, der ihn aufloest.
 *
 *   pnpm run merge:queue -- --check [--pr 948]   # Bericht, Exit 1 wenn nichts READY
 *   pnpm run merge:queue -- --publish            # neue Plan-Revision an #913
 *   pnpm run merge:queue -- --ack --session s1   # Bestaetigung dieser Revision
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/report.mjs';
import { rest } from './lib/github-rest.mjs';
import { TOKEN_FIX_COMMAND, resolveGithubToken } from './lib/credentials.mjs';
import {
  MERGE_ISSUE,
  ackCommand,
  authorizeMerge,
  buildQueue,
  latestPlan,
  parseMergeEvents,
  planBody,
  publishCommand,
} from './lib/merge-queue.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const asJson = flag('json');
const issue = Number(value('issue', String(MERGE_ISSUE)));
const session = value('session', process.env.RBD_SESSION ?? `session-${process.env.HOSTNAME ?? 'local'}`);
const role = value('role', 'worker');
const agent = value('agent', process.env.RBD_AGENT ?? 'agent-local');
const at = value('at', process.env.RBD_NOW ?? '');
const prFlag = value('pr');
const wantedPr = prFlag === null ? null : Number(prFlag);

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function repoSlug() {
  const explicit = process.env.RBD_REPO || process.env.GITHUB_REPOSITORY || value('repo');
  if (explicit) return explicit;
  const url = git(['config', '--get', 'remote.origin.url']);
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  return match ? `${match[1]}/${match[2]}` : '';
}

const repo = repoSlug();
const mainSha = git(['rev-parse', 'origin/main']) || git(['rev-parse', 'HEAD']);

if (!repo) {
  console.error('merge:queue: Repository nicht bestimmbar; `RBD_REPO=owner/repo` setzen');
  process.exit(2);
}
if (!resolveGithubToken().token) {
  console.error(`merge:queue: keine Credential-Quelle; aufloesen mit genau einem Befehl: \`${TOKEN_FIX_COMMAND}\``);
  process.exit(2);
}

const detail = rest('issue-view', { number: issue, repo });
if (!detail.ok) {
  console.error(`merge:queue: #${issue} nicht lesbar (${detail.error}); Merge bleibt gesperrt (fail-closed)`);
  process.exit(1);
}
const comments = Array.isArray(detail.data?.comments) ? detail.data.comments : [];
const pullsResult = rest('pr-list', { state: 'open', limit: 50, repo });
if (!pullsResult.ok) {
  console.error(`merge:queue: offene PRs nicht lesbar (${pullsResult.error}); Merge bleibt gesperrt (fail-closed)`);
  process.exit(1);
}
const pulls = Array.isArray(pullsResult.data) ? pullsResult.data : [];
const events = parseMergeEvents(comments);
const plan = latestPlan(events);

function postComment(body) {
  const posted = rest('issue-comment', { number: issue, body, repo });
  if (!posted.ok) {
    console.error(`merge:queue: Kommentar an #${issue} nicht geschrieben (${posted.error})`);
    process.exit(1);
  }
  return posted.data;
}

if (flag('publish')) {
  const revision = events.filter((event) => event.kind === 'PLAN').length + 1;
  const body = planBody({ revision, mainSha, pulls, at });
  const posted = postComment(body.body);
  const sessions = events.filter((event) => event.kind === 'SESSION_JOIN').length;
  console.log(`merge:queue: Revision ${revision} an #${issue} veroeffentlicht (Plan ${body.hash}, main ${mainSha.slice(0, 7)}, ${body.entries.length} PRs, Kommentar ${posted?.id ?? '?'})`);
  console.log(`  Bestaetigung je Session: ${ackCommand(session, role)}`);
  if (sessions === 0) console.log(`  Hinweis: keine Session registriert — vorher MERGE_SESSION_JOIN an #${issue} posten, sonst bleibt die Queue HOLD.`);
  process.exit(0);
}

if (flag('ack')) {
  if (!plan) {
    console.error(`merge:queue: ACK ohne Plan ist sinnlos; zuerst: \`${publishCommand()}\``);
    process.exit(1);
  }
  const body = [
    `MERGE_ACK session=${session} role=${role} plan=${plan.hash} main=${plan.mainSha}${at ? ` at=${at}` : ''}`,
    '',
    `Bestaetigt: Revision ${plan.revision}, Plan ${plan.hash}, \`main\` ${plan.mainSha.slice(0, 7)}, ${plan.entries.length} PRs.`,
    `Agent ${agent}, Session ${session}.`,
  ].join('\n');
  const posted = postComment(body);
  console.log(`merge:queue: ACK fuer Plan ${plan.hash} als ${session} (${role}) geschrieben (Kommentar ${posted?.id ?? '?'})`);
  process.exit(0);
}

const queue = buildQueue({ plan, pulls, events, mainSha });
const sessions = events.filter((event) => event.kind === 'SESSION_JOIN').length - events.filter((event) => event.kind === 'SESSION_LEAVE').length;
const ready = queue.filter((row) => row.status === 'READY');

if (wantedPr !== null) {
  const decision = authorizeMerge({ plan, pulls, events, mainSha, prNumber: wantedPr });
  if (asJson) {
    console.log(JSON.stringify({ ok: decision.ok, status: decision.status, reason: decision.reason, plan: plan ? { revision: plan.revision, hash: plan.hash, mainSha: plan.mainSha } : null, queue: decision.queue }, null, 2));
  } else {
    console.log(`merge:queue — ${repo} · #${issue} · main ${mainSha.slice(0, 7)}`);
    console.log(`  PR #${wantedPr}: ${decision.status} — ${decision.reason}`);
  }
  if (!decision.ok) {
    console.error('');
    console.error('merge:queue: MERGE GESPERRT — genau ein naechster Befehl:');
    if (!plan) console.error(`  - \`${publishCommand()}\`, danach je Session \`${ackCommand(session, role)}\``);
    else console.error(`  - Queue pruefen: \`pnpm run merge:queue -- --check\`; fehlende ACKs je Session mit \`${ackCommand(session, role)}\``);
    process.exit(1);
  }
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({
    ok: ready.length > 0,
    repo,
    issue,
    mainSha,
    plan: plan ? { revision: plan.revision, hash: plan.hash, mainSha: plan.mainSha, tampered: plan.tampered, entries: plan.entries } : null,
    sessions,
    ready: ready.map((row) => row.number),
    queue,
    nextCommand: plan ? (ready.length > 0 ? `gh pr merge ${ready[0].number} --squash --match-head-commit ${ready[0].head}` : ackCommand(session, role)) : publishCommand(),
  }, null, 2));
  process.exit(ready.length > 0 ? 0 : 1);
}

console.log(`merge:queue — ${repo} · #${issue} · main ${mainSha.slice(0, 7)}`);
console.log(`  Plan: ${plan ? `Revision ${plan.revision}, Hash ${plan.hash}, main ${plan.mainSha.slice(0, 7)}${plan.tampered ? ' (MANIPULIERT)' : ''}` : 'keine bestaetigte Revision'}`);
console.log(`  Sessions: ${Math.max(0, sessions)} registriert · READY: ${ready.length}`);
console.log('');
console.log('  | PR | Position | Status | Grund |');
console.log('  | --- | --- | --- | --- |');
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
for (const row of queue) console.log(`  | #${row.number} | ${row.position || '—'} | ${row.status} | ${cell(row.reasons.join(' · '))} |`);
console.log('');
if (ready.length > 0) {
  console.log(`  Naechster Befehl: gh pr merge ${ready[0].number} --squash --match-head-commit ${ready[0].head}`);
} else {
  console.log(`  Naechster Befehl: ${plan ? ackCommand(session, role) : publishCommand()}`);
}
process.exit(ready.length > 0 ? 0 : 1);
