#!/usr/bin/env node
/** Build or refresh the PR from every commit since main, preserving their evidence. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describePlan, plan } from './lib/escalation.mjs';
import { ROOT } from './lib/report.mjs';

const SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const asJson = args.includes('--json') || args.includes('--connector');
const git = (argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }).trim();

function sectionLines(body, header) {
  const lines = body.split(/\r?\n/);
  const index = lines.indexOf(header);
  if (index < 0) return [];
  const next = lines.findIndex((line, offset) => offset > index && line.startsWith('### '));
  return lines.slice(index + 1, next < 0 ? undefined : next).map((line) => line.trim()).filter(Boolean);
}

function plainBodyLines(body) {
  const lines = body.split(/\r?\n/);
  const excluded = new Set(SECTIONS);
  return lines.map((line) => line.trim()).filter((line) => line && !excluded.has(line) && !line.startsWith('### '));
}

const branch = process.env.BRANCH ?? git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch === 'main' || branch === 'integration' || branch.includes('..')) {
  console.error(`pr-escalation: ungueltiger Arbeitsbranch '${branch}'`);
  process.exit(1);
}

if (process.env.BRANCH) {
  try {
    execFileSync('git', ['fetch', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    console.error(`pr-escalation: Remote-Branch '${branch}' fehlt`);
    process.exit(1);
  }
}
const headRef = process.env.BRANCH ? `origin/${branch}` : 'HEAD';

function commitsSinceMain() {
  const base = git(['merge-base', 'origin/main', headRef]);
  const raw = git(['log', '--reverse', `--format=%H%x1f%s%x1f%b%x1e`, `${base}..${headRef}`]);
  return raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [sha, subject, ...body] = record.split('\x1f');
    return { sha, subject, body: body.join('\x1f').trim() };
  });
}

function buildBody() {
  const commits = commitsSinceMain();
  if (commits.length === 0) {
    const sha = git(['rev-parse', headRef]);
    commits.push({ sha, subject: git(['log', '-1', '--pretty=%s', headRef]), body: git(['log', '-1', '--pretty=%b', headRef]) });
  }
  const changed = git(['diff', '--name-only', `origin/main...${headRef}`]).split(/\r?\n/).filter(Boolean);
  const changes = [];
  const technical = [];
  const outlook = [];
  for (const commit of commits) {
    changes.push(`**${commit.subject}** (\`${commit.sha.slice(0, 8)}\`)`);
    const section = sectionLines(commit.body, SECTIONS[0]);
    const plain = section.length > 0 ? section : plainBodyLines(commit.body);
    for (const line of plain) changes.push(line.startsWith('- ') ? line : `- ${line}`);
    if (section.length === 0 && plain.length === 0) changes.push(`- Commit \`${commit.sha.slice(0, 8)}\` ohne zusaetzlichen Body.`);
    technical.push(...sectionLines(commit.body, SECTIONS[1]));
    outlook.push(...sectionLines(commit.body, SECTIONS[2]));
  }
  if (changed.length > 0) technical.push(`Geaenderte Pfade: ${changed.map((file) => `\`${file}\``).join(', ')}`);
  if (technical.length === 0) technical.push('Offen: Die Commit-Bodies enthalten keine technische Begruendung.');
  if (outlook.length === 0) outlook.push('Offen: Die Commit-Bodies enthalten keinen Ausblick.');
  const asBullets = (lines) => lines.map((line) => line.startsWith('- ') || line.startsWith('**') ? line : `- ${line}`);
  return [
    SECTIONS[0],
    ...asBullets(changes),
    '',
    SECTIONS[1],
    ...asBullets(technical),
    '',
    SECTIONS[2],
    ...asBullets(outlook),
    '',
  ].join('\n');
}

const title = git(['log', '-1', '--pretty=%s', headRef]);
const body = buildBody();
const file = resolve(ROOT, git(['rev-parse', '--git-dir']), 'rbd-pr-body.md');
writeFileSync(file, `${body}\n`);
const escalation = plan('PR-Body aus dem vollstaendigen Commit-Verlauf gebaut');
const connector = { level: escalation.level, scope: escalation.scope, channel: 'github-connector', branch, base: 'main', title, bodyFile: file, body };

if (asJson) {
  console.log(JSON.stringify(connector, null, 2));
  process.exit(0);
}
if (dryRun) {
  console.log(body);
  process.exit(0);
}

const gh = (argv) => execFileSync('gh', argv, { cwd: ROOT, encoding: 'utf8' }).trim();
try {
  const existing = gh(['pr', 'list', '--head', branch, '--base', 'main', '--state', 'open', '--json', 'number', '--jq', '.[0].number']);
  let created = false;
  if (existing) {
    gh(['pr', 'edit', existing, '--title', title, '--body-file', file]);
    console.log(`pr-escalation: PR #${existing} fuer ${branch} aus ${commitsSinceMain().length} Commit(s) aktualisiert`);
  } else {
    gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body-file', file]);
    created = true;
    console.log(`pr-escalation: PR fuer ${branch} aus ${commitsSinceMain().length} Commit(s) angelegt`);
  }
  const dispatchNeeded = process.env.RBD_DISPATCH_CI === '1'
    && (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || created);
  if (dispatchNeeded) {
    gh(['workflow', 'run', 'ci-verify.yml', '--ref', branch]);
    gh(['workflow', 'run', 'long-checks.yml', '--ref', branch, '--field', 'advisory=true']);
    console.log(`pr-escalation: CI Verify und betroffene lange Advisory-Tests fuer ${branch} dispatcht`);
  }
} catch (error) {
  const reason = error instanceof Error ? error.message.split('\n')[0] : 'Fehler';
  console.log(`pr-escalation: gh nicht verfuegbar (${reason})`);
  console.log(describePlan(escalation));
  console.log('  Connector-Plan: node scripts/lift-commit-body.mjs --json');
  console.log(`  Body: ${file}`);
  process.exit(2);
}
