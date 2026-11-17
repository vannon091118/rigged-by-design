#!/usr/bin/env node
/**
 * agent:start — der eine globale Einstieg fuer Maintainer und Worker.
 *
 * Board, Claims und Postfach kommen live aus GitHub; die Datei braucht keinen
 * lokalen Zustand. Sie fuehrt Board-Lesen, Pretask, Webhook-Status und den
 * Mechanik-Scan in einem Bericht zusammen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { captureConsole } from './lib/compact.mjs';
import { TOKEN_FIX_COMMAND, resolveGithubToken } from './lib/credentials.mjs';
import { ensureGh } from './lib/gh-bootstrap.mjs';
import { readIdentityFile, workspacePaths } from './lib/workspace-home.mjs';
import { hookStatus } from './lib/webhook-status.mjs';
import { loadBoardState } from './lib/agent-start-board.mjs';
import { runPretaskVerdict, withResolution } from './lib/agent-start-pretask.mjs';
import { scanMechanics } from './lib/agent-start-mechanics.mjs';
import { printAgentStart } from './lib/agent-start-report.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

// `--json` ist Werkzeugformat und bleibt vollstaendig; `--brief` ist die Kurzform.
const asJson = flag('json');
const brief = flag('brief');
captureConsole({ label: 'agent-start', enabled: !asJson });
const limit = Math.max(1, Number(value('limit', '8')));

function sessionIdentity() {
  if (process.env.RBD_AGENT) return process.env.RBD_AGENT;
  try {
    return readIdentityFile(workspacePaths().identity)?.identity ?? 'agent-local';
  } catch {
    return 'agent-local';
  }
}

const agent = value('agent', sessionIdentity());
const issueFlag = value('issue');
const wantedIssue = issueFlag === null ? null : Number(issueFlag);
const at = value('at', process.env.RBD_NOW ?? new Date().toISOString());
if (Number.isNaN(Date.parse(at))) {
  console.error('agent:start: --at/RBD_NOW ist kein ISO-Zeitpunkt');
  process.exit(2);
}
const now = Date.parse(at);
const blockers = [];
const warnings = [];
const notes = [];

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
const credentials = resolveGithubToken();
if (!credentials.token) {
  const gh = ensureGh();
  const ghNote = gh.present ? '' : ` \`gh\` fehlt; Installation: ${gh.install?.url ?? 'https://cli.github.com'}.`;
  blockers.push(
    `[ERR-4019] Keine Credential-Quelle: geprueft wurde ${credentials.tried.join(' -> ')}. ` +
      `Aufloesen mit genau einem Befehl: \`${TOKEN_FIX_COMMAND}\`${ghNote}`,
  );
  if (!repo) warnings.push('Repository nicht bestimmbar (origin zeigt nicht auf GitHub): nach dem Login `RBD_REPO=owner/repo` setzen');
} else if (!repo) {
  blockers.push('[ERR-4019] Repository nicht bestimmbar; `git remote add origin <url>` oder RBD_REPO=owner/repo setzen');
}

const actorsFile = join(ROOT, '.lane-claims', 'actors.json');
let actors = {};
let policyMissing = false;
if (existsSync(actorsFile)) {
  try {
    const parsed = JSON.parse(readFileSync(actorsFile, 'utf8'));
    actors = parsed?.actors ?? parsed ?? {};
  } catch (error) {
    policyMissing = true;
    warnings.push(`Actor-Policy unlesbar (${String(error?.message ?? error).slice(0, 100)}): Kommentare autorisieren nichts`);
  }
} else {
  policyMissing = true;
  warnings.push('Actor-Policy fehlt (.lane-claims/actors.json): Claim-Bewertung ist fail-closed');
}

let board = { ok: false, rows: [], pulls: [], total: 0 };
let next = null;
if (blockers.length === 0) {
  const result = loadBoardState({ repo, agent, now, actors, wantedIssue, limit });
  board = result.board;
  next = result.next;
  blockers.push(...result.blockers);
  warnings.push(...result.warnings);
}

const pretask = board.ok ? runPretaskVerdict({ flag, value }) : { ran: false, reason: 'Board nicht lesbar: pretask uebersprungen' };
if (pretask.ran) {
  for (const blocker of pretask.blockers ?? []) blockers.push(`${withResolution(blocker)} (aus agent:pretask)`);
} else if (pretask.reason) {
  warnings.push(pretask.reason);
}

const webhook = board.ok
  ? hookStatus({ repo })
  : { ok: false, hooks: [], active: 0, events: [], url: '', error: 'Board nicht lesbar', step: '' };

const mechanics = scanMechanics();
if (mechanics.unused.length > 0) {
  warnings.push(
    `${mechanics.unused.length} Mechanik(en) ohne Ausfuehrungspfad: ` +
      `${mechanics.unused.map((entry) => entry.file).join(', ')}; je Datei entscheiden: einbinden oder entfernen`,
  );
}
if (mechanics.orphan.length > 0) {
  blockers.push(
    `[ERR-4019] ${mechanics.orphan.length} vergessene(s) System(e) ohne Aufrufer: ` +
      `${mechanics.orphan.map((entry) => entry.file).join(', ')}; jede Datei wird eingebunden oder entfernt`,
  );
}

function apkRelevance() {
  const prevTag = git(['describe', '--tags', '--abbrev=0']);
  if (!prevTag) return { checked: false, reason: 'kein Vor-Tag im Klon: Relevanz unbekannt (flacher Klon)' };
  try {
    const output = execFileSync(process.execPath, [join(ROOT, 'scripts', 'release-impact.mjs'), `--prev=${prevTag}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = /apk=(true|false)/.exec(output);
    return { checked: true, prevTag, apk: match ? match[1] === 'true' : null };
  } catch (error) {
    return { checked: false, reason: `release-impact nicht auswertbar (${String(error?.message ?? error).split('\n')[0].slice(0, 120)})` };
  }
}
const apk = apkRelevance();

const claimBody = () => `CLAIM [A1] ${agent} ${at} scope=<pfade> plan=<ein Satz, was dieses Issue erledigt>`;
const steps = [];
if (next) {
  steps.push(`CLAIM im Issue setzen: gh issue comment ${next.number} --body "${claimBody()}"`);
  steps.push(`Lane-Branch: git switch -c fix/${next.number}-<slug> origin/main`);
  steps.push('Arbeit im Claim-Scope; vor dem Push `pnpm run verify:fast`');
  steps.push(`Uebergabe: push + PR gegen main, dann RELEASE [A1] done <sha> am Issue #${next.number}`);
} else if (board.ok) {
  steps.push('Kein freies Issue: Review/Blocker beim Maintainer, keine neue Lane');
}
if (!webhook.ok && webhook.step) steps.push(`Webhook: ${webhook.step}`);
if (mechanics.orphan.length > 0) steps.push('Vergessene Systeme einbinden oder entfernen (siehe Blocker)');
if (mechanics.unused.length > 0) steps.push(`Ohne Ausfuehrungspfad: ${mechanics.unused.map((entry) => entry.file).join(', ')} — einbinden oder entfernen`);
if (!policyMissing) steps.push('Nach dem Push: PR ueber `gh pr create` (oder Konnektor) oeffnen und Review anfordern; Board lokal nachziehen mit `pnpm run board:sync`');

printAgentStart({ asJson, brief, repo, at, agent, credentials, board, next, mechanics, pretask, webhook, apk, blockers, warnings, notes, steps });

if (blockers.length > 0) {
  console.error('');
  console.error('agent:start: BLOCKIERT — jeder Punkt nennt den aufloesenden Befehl:');
  for (const blocker of blockers) console.error(`  - ${blocker}`);
  process.exit(1);
}
