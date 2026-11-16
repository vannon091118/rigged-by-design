#!/usr/bin/env node
/**
 * agent:start — der eine globale Einstieg fuer Maintainer und Worker.
 *
 * Warum es diese Datei gibt: `pretask` beantwortet nur den lokalen Arbeitsbaum.
 * Board, Claims und Postfach lagen daneben in `.lane-claims/` und `.lanes/` und
 * waren nach jedem frischen Klon oder Restore weg. Dieser Lauf liest alles
 * direkt aus GitHub und braucht daher **keinen lokalen Zustand**: kein
 * `board-state.json`, keine Claim-Datei, keine Identitaetsdatei.
 *
 * Einzige Voraussetzung ist ein Token in der Umgebung — `GH_TOKEN` oder
 * `GITHUB_TOKEN`. Das Token kommt aus dem Projekt-Secret bzw. dem
 * Repository-Secret und liegt nie im Repo.
 *
 * Was der Lauf liefert:
 *   1. Board in Arbeitsreihenfolge, aeltestes Issue je Prioritaet zuerst.
 *   2. Claim- und Postfachlage je Issue aus dem Kommentarverlauf.
 *   3. Je Zeile den naechsten Akteur und **warum** er dran ist.
 *   4. Den Mechanik-Stand: was im Ablauf erzwungen wird, was automatisch
 *      laeuft und was niemand aufruft (vergessenes System).
 *   5. Die genauen naechsten Befehle, keine Prosa.
 *
 * Blockierend, aber instruierend: jeder Blocker nennt den einen Befehl, der
 * ihn aufloest. Exit 1 bei Blocker, 0 sonst.
 *
 * Aufruf:
 *   pnpm run agent:start -- --brief
 *   pnpm run agent:start -- --json --issue 874
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { evaluateIssueClaim, orderBoard } from './lib/issue-claim.mjs';
import { rest } from './lib/github-rest.mjs';
import { TOKEN_FIX_COMMAND, resolveGithubToken } from './lib/credentials.mjs';
import { ensureGh } from './lib/gh-bootstrap.mjs';
import { readIdentityFile, workspacePaths } from './lib/workspace-home.mjs';
import {
  MERGE_ISSUE,
  ackCommand,
  activeSessions,
  buildQueue,
  latestPlan,
  parseMergeEvents,
  publishCommand,
} from './lib/merge-queue.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const asJson = flag('json');
const brief = flag('brief');
const limit = Math.max(1, Number(value('limit', '8')));
/**
 * Die Session-Identitaet steht in `.lanes/identity.json` (global im
 * Identity-Board reserviert). Ohne `RBD_AGENT` gilt sie, damit ein frischer
 * Aufruf nicht als fremder `agent-local` an der eigenen Lane scheitert.
 */
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
// Wanduhr nur fuer den Laufzeitstempel des Berichts; die Arbeit selbst bleibt
// deterministisch, weil Reihenfolge und Alter aus Issue-Daten kommen.
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

/** `owner/repo` aus Env oder origin; ohne Remote ist das Board nicht adressierbar. */
function repoSlug() {
  const explicit = process.env.RBD_REPO || process.env.GITHUB_REPOSITORY || value('repo');
  if (explicit) return explicit;
  const url = git(['config', '--get', 'remote.origin.url']);
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  return match ? `${match[1]}/${match[2]}` : '';
}

const repo = repoSlug();

// --- 1. Credentials ------------------------------------------------------
// Eine Aufloesungsstelle (`lib/credentials.mjs`): GH_TOKEN, GITHUB_TOKEN,
// `gh auth token`, git-credential-helper. Nichts wird gespeichert oder
// committet; ohne Quelle bricht der Lauf mit genau einem Befehl ab.
const credentials = resolveGithubToken();
const token = credentials.token;
if (!token) {
  // Kein Workflow, kein Actions: fehlt `gh`, laedt der Lauf die CLI jetzt
  // aus dem offiziellen Release nach (~/.local/bin, ohne sudo). Danach fehlt
  // nur noch `gh auth login`.
  const gh = ensureGh();
  const ghNote = gh.present
    ? (gh.attempted ? ` \`gh\` wurde nachgeladen (${gh.path ?? 'gh'}); PATH ergaenzen, falls noetig.` : '')
    : ` \`gh\` fehlt (${gh.install?.reason ?? 'unbekannt'}); manuell: ${gh.install?.url ?? 'https://cli.github.com'}.`;
  // Genau ein Blocker: ohne Credential-Quelle ist alles andere zweitrangig,
  // und der Agent soll genau einen Befehl ausfuehren, nicht drei.
  blockers.push(
    `[ERR-4019] Keine Credential-Quelle: geprueft wurde ${credentials.tried.join(' -> ')}. ` +
      `Aufloesen mit genau einem Befehl: \`${TOKEN_FIX_COMMAND}\`${ghNote}`,
  );
  if (!repo) {
    warnings.push('Repository nicht bestimmbar (origin zeigt nicht auf GitHub): nach dem Login `RBD_REPO=owner/repo` setzen');
  }
} else if (!repo) {
  blockers.push('[ERR-4019] Repository nicht bestimmbar; `git remote add origin <url>` oder RBD_REPO=owner/repo setzen');
}

// --- 2. Actors-Policy (Regel, kein Zustand) -------------------------------
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

// --- 3. Board live lesen --------------------------------------------------
const labelNames = (labels = []) => labels
  .map((label) => (typeof label === 'string' ? label : label?.name))
  .filter(Boolean);

const PRIORITY_REASON = Object.freeze({
  P0: 'Notfall: Save, RNG, Ledger, Boot oder Kernschleife betroffen',
  P1: 'wartender Review oder Gate, das mehrere Lanes blockiert',
  P2: 'Gameplay-Bug oder fehlender spielrelevanter Inhalt',
  P3: 'Board-/Governance-Struktur, die echte Arbeit blockiert',
  P4: 'ohne Prio-Label: nicht triagiert, deshalb nicht delegierbar',
});

const PHASE = Object.freeze({
  'zustand-open': 'OPEN_READY',
  'zustand-claimed': 'OPEN_CLAIMED',
  'zustand-block': 'OPEN_BLOCKED',
  'zustand-needs-info': 'OPEN_WAITING',
  'zustand-needs-evidence': 'OPEN_WAITING',
  'zustand-regression': 'OPEN_READY (Regression)',
  'zustand-rootcause': 'OPEN_READY (Root-Cause)',
});

function phaseOf(labels) {
  const lower = labels.map((label) => label.toLowerCase());
  if (lower.includes('review-waiting')) return 'REVIEW_WAITING';
  const state = lower.find((label) => label.startsWith('zustand-'));
  return state ? (PHASE[state] ?? state.toUpperCase()) : 'UNTRIAGED';
}

/**
 * Der PR, der ein Issue traegt. Branch-Schema zuerst, dann ein ausdruecklicher
 * Verweis im PR-Body; eine beilaeufige Erwaehnung ordnet nichts zu.
 */
function prFor(number, pulls) {
  const branch = new RegExp(`(?:issue[-_/]|fix[-/])${number}(?!\\d)`, 'i');
  const body = new RegExp(`(?:closes|fixes|resolves|schliesst)\\s+#${number}(?!\\d)`, 'i');
  return pulls.find((pull) => branch.test(pull.headRefName ?? ''))
    ?? pulls.find((pull) => body.test(pull.body ?? ''))
    ?? null;
}

function nextActorOf({ claim, phase, pr, blocked }) {
  if (blocked) return 'User/Maintainer: Blocker (zustand-BLOCK) aufloesen';
  if (pr) return `Maintainer: PR #${pr.number} gegen das Issue pruefen`;
  if (phase === 'REVIEW_WAITING') return 'Maintainer: Label und PR-Lage in Deckung bringen';
  if (claim.status === 'claimed-other') return `Worker ${claim.holder} (${claim.claimId})`;
  if (claim.status === 'stale') return 'Maintainer: veralteten Claim freigeben, dann neu zuweisen';
  if (claim.status === 'free') return 'Freier Worker: CLAIM setzen, dann starten';
  if (claim.status === 'unknown') return 'Maintainer: Board nicht lesbar, Claim-Lage klaeren';
  return 'Maintainer: triagieren und zuweisen';
}

let board = { ok: false, rows: [], pulls: [], total: 0 };
if (blockers.length === 0) {
  const listed = rest('issue-list', { state: 'open', limit: 100, repo });
  if (!listed.ok) {
    blockers.push(`[ERR-4019] Board nicht lesbar (${listed.error}); kein Bericht aus Vermutungen`);
  } else {
    const issues = (Array.isArray(listed.data) ? listed.data : []).filter(
      (issue) => issue && (issue.labels || issue.title),
    );
    const pullsResult = rest('pr-list', { state: 'open', limit: 50, repo });
    const pulls = pullsResult.ok && Array.isArray(pullsResult.data) ? pullsResult.data : [];
    if (!pullsResult.ok) {
      warnings.push(`Offene PRs nicht lesbar (${pullsResult.error}): Zeilen ohne PR-Bezug`);
    }
    // Reihenfolge: Prioritaet, Zustand, dann aeltestes Issue — dieselbe
    // Klassifikation wie board:overview, keine zweite Wahrheit.
    const ordered = orderBoard(issues);
    const selected = wantedIssue
      ? ordered.filter((issue) => Number(issue.number) === wantedIssue)
      : ordered.slice(0, limit);
    if (wantedIssue && selected.length === 0) {
      blockers.push(`[ERR-4019] Issue #${wantedIssue} ist nicht offen oder nicht lesbar`);
    }
    const rows = [];
    for (const issue of selected) {
      const detail = rest('issue-view', { number: Number(issue.number), repo });
      const labels = detail.ok ? labelNames(detail.data?.labels) : labelNames(issue.labels);
      const comments = detail.ok ? detail.data?.comments ?? [] : [];
      const claim = detail.ok
        ? evaluateIssueClaim({ comments, agent, now, staleHours: 2, actors })
        : { status: 'unknown', holder: null, claimId: null, error: detail.error, rejected: [] };
      if (!detail.ok) warnings.push(`Issue #${issue.number}: Verlauf nicht lesbar (${detail.error}); Claim unbekannt`);
      const phase = claim.status.startsWith('claimed') && phaseOf(labels) === 'OPEN_READY' ? 'OPEN_CLAIMED' : phaseOf(labels);
      const pr = prFor(Number(issue.number), pulls);
      const blocked = labels.some((label) => label.toLowerCase() === 'zustand-block');
      const reasons = [PRIORITY_REASON[issue.priority] ?? PRIORITY_REASON.P4];
      reasons.push(issue.createdAt ? `angelegt ${String(issue.createdAt).slice(0, 10)}` : 'ohne Anlagedatum');
      if (phase === 'REVIEW_WAITING') reasons.push('Uebergabe wartet auf Verdikt');
      if (pr) reasons.push(`offener PR #${pr.number} (${pr.headRefName})`);
      if (claim.status === 'free') reasons.push('kein Claim: frei');
      if (claim.status === 'claimed-other') reasons.push(`besetzt: ${claim.holder} ${claim.claimId} seit ${claim.since}`);
      if (claim.status === 'stale') reasons.push(`Claim ${claim.ageHours}h ohne Aktivitaet: nicht uebernehmen`);
      if (claim.status === 'unknown') reasons.push(`Claim-Lage unbekannt (${claim.error ?? 'Lesefehler'})`);
      if (blocked) reasons.push('zustand-BLOCK haelt die Lane an');
      rows.push({
        number: Number(issue.number),
        title: String(issue.title ?? ''),
        priority: issue.priority,
        phase,
        claim: {
          status: claim.status,
          holder: claim.holder ?? null,
          claimId: claim.claimId ?? null,
          since: claim.since ?? null,
          ageHours: claim.ageHours ?? null,
        },
        pr: pr ? { number: Number(pr.number), head: pr.headRefName, draft: Boolean(pr.draft) } : null,
        nextActor: nextActorOf({ claim, phase, pr, blocked }),
        reasons,
      });
    }
    board = { ok: true, rows, pulls, total: issues.length };
  }
}

// Das naechste Issue ist die erste Zeile, die ein Worker wirklich uebernehmen
// darf: frei, ohne offenen PR, ohne Block. Alles andere nennt den Akteur.
const next = board.rows.find(
  (row) => row.claim.status === 'free' && !row.pr && row.phase !== 'OPEN_BLOCKED' && row.phase !== 'REVIEW_WAITING',
) ?? null;

if (wantedIssue) {
  const row = board.rows.find((entry) => entry.number === wantedIssue);
  if (row && row.claim.status === 'claimed-other') {
    blockers.push(
      `[ERR-4019] Issue #${row.number} haelt ${row.claim.holder} (${row.claim.claimId}); ` +
        `erst RELEASE/HANDOFF im Issue abwarten. Alternative: \`pnpm run agent:start -- --issue ${next?.number ?? '<nr>'}\``,
    );
  } else if (row && row.claim.status === 'stale') {
    blockers.push(
      `[ERR-4019] Issue #${row.number}: Claim von ${row.claim.holder} ist ${row.claim.ageHours}h alt; ` +
        `Maintainer gibt frei: \`gh issue comment ${row.number} --body "RELEASE [${row.claim.claimId}] abandoned stale"\``,
    );
  } else if (row && row.pr) {
    blockers.push(
      `[ERR-4019] Issue #${row.number} haengt an PR #${row.pr.number}: Merge/Review liegt beim Maintainer, keine neue Lane`,
    );
  }
} else if (board.ok && board.rows.length > 0 && !next) {
  notes.push('Kein freies Issue in den gezeigten Zeilen; alle Kandidaten sind besetzt oder warten auf Review.');
}

// --- 3b. Pretask und Merge-Queue -----------------------------------------
/**
 * Pretask gehoert in diesen Lauf: ein Befehl muss reichen. Der Aufruf liefert
 * denselben Vertrag wie `agent:pretask`; scheitert er, bleibt der Bericht
 * nutzbar und nennt den Ersatzbefehl, statt zu raten.
 */
function summarizePretask(parsed) {
  const task = parsed?.taskState ?? {};
  return {
    mode: parsed?.mode ?? null,
    claimState: parsed?.claimState ?? null,
    phase: task.phase ?? null,
    status: task.status ?? null,
    blockers: Array.isArray(parsed?.blockers) ? parsed.blockers.slice(0, 3) : [],
    nextActions: Array.isArray(parsed?.nextActions) ? parsed.nextActions.slice(0, 2) : [],
  };
}

/**
 * Ein pretask-Blocker nennt oft nur den Zustand ("geclaimt durch X"). Der
 * Start nennt zusaetzlich den einen Befehl, der ihn aufloest: die eigene
 * Session-Identitaet, wenn man dieser Halter ist.
 */
function withResolution(text) {
  const holder = /durch ([A-Za-z0-9_.-]+) geclaimt/.exec(String(text))?.[1];
  if (holder) return `${text}; wenn du diese Session bist: \`RBD_AGENT=${holder} pnpm run agent:start --brief\`, sonst RELEASE/HANDOFF abwarten`;
  return text;
}

function pretaskVerdict() {
  if (flag('no-pretask')) return { ran: false, reason: '--no-pretask gesetzt' };
  const args = [join(ROOT, 'scripts', 'pretask.mjs'), '--json'];
  // Laufbudget gehoert zum Aufruf, nicht zu einer zweiten Runde: derselbe
  // Befehl nimmt die belegte Zahl aus Flag oder Umgebung mit.
  const budget = value('new-governance-issues', process.env.RBD_NEW_GOVERNANCE_ISSUES);
  if (budget !== null && budget !== undefined) args.push('--new-governance-issues', String(budget));
  const options = { cwd: ROOT, encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    return { ran: true, ...summarizePretask(JSON.parse(execFileSync(process.execPath, args, options))) };
  } catch (error) {
    // pretask meldet Blocker mit Exit 1 und JSON auf stdout — das ist ein Befund.
    try {
      return { ran: true, ...summarizePretask(JSON.parse(String(error?.stdout ?? ''))) };
    } catch {
      return { ran: false, reason: `pretask nicht auswertbar (${String(error?.message ?? error).split('\n')[0].slice(0, 120)}); Fallback: \`pnpm run agent:pretask --json\`` };
    }
  }
}

const queueSteps = [];
const pretask = board.ok ? pretaskVerdict() : { ran: false, reason: 'Board nicht lesbar: pretask uebersprungen' };
if (pretask.ran) {
  for (const blocker of pretask.blockers ?? []) blockers.push(`${withResolution(blocker)} (aus agent:pretask)`);
} else if (pretask.reason) {
  warnings.push(pretask.reason);
}

// Merge-Queue (#913): die Reihenfolge ist Teil des Starts, kein Extra-Befehl.
let mergeQueue = null;
if (board.ok) {
  const thread = rest('issue-view', { number: MERGE_ISSUE, repo });
  if (!thread.ok) {
    mergeQueue = { ok: false, issue: MERGE_ISSUE, plan: null, sessions: [], queue: [], nextCommand: publishCommand(), error: thread.error };
    warnings.push(`Merge-Queue #${MERGE_ISSUE} nicht lesbar (${thread.error}): Merge bleibt gesperrt (fail-closed)`);
  } else {
    const events = parseMergeEvents(thread.data?.comments ?? []);
    const plan = latestPlan(events);
    const queue = buildQueue({ plan, pulls: board.pulls, events, mainSha: git(['rev-parse', 'origin/main']) });
    const ready = queue.filter((row) => row.status === 'READY');
    mergeQueue = {
      ok: ready.length > 0,
      issue: MERGE_ISSUE,
      plan: plan ? { revision: plan.revision, hash: plan.hash, mainSha: plan.mainSha, tampered: plan.tampered } : null,
      sessions: activeSessions(events).map((entry) => entry.session),
      queue,
      nextCommand: ready.length > 0
        ? `gh pr merge ${ready[0].number} --squash --match-head-commit ${ready[0].head}`
        : plan ? ackCommand(agent, 'worker') : publishCommand(),
    };
    if (!plan) queueSteps.push(`Merge-Queue: keine bestaetigte Revision — \`${publishCommand()}\`, dann je Session \`${ackCommand(agent, 'worker')}\``);
    else if (ready.length === 0) queueSteps.push(`Merge-Queue HOLD (Plan ${plan.hash}): fehlende ACKs, dann \`${mergeQueue.nextCommand}\``);
  }
}

// --- 4. Mechaniken: was erzwungen wird, was niemand aufruft --------------
/**
 * Status:
 *   FLOW    dieser Lauf prueft und blockiert damit selbst
 *   AUTO    Hook oder Skript fuehrt es ohne Agentenaktion aus
 *   WIRED   ueber ein manuelles Kommando erreichbar (package.json)
 *   UNUSED  nur aus Tests oder Doku bekannt: existiert, wird aber nie ausgefuehrt
 *   ORPHAN  niemand referenziert es: vergessenes System -> Blocker
 *
 * `UNUSED` blockiert nicht, weil getestete oder dokumentierte Dateien nicht
 * still geloescht werden duerfen; der Lauf nennt sie und die Entscheidung
 * (einbinden oder entfernen) bleibt sichtbar.
 */
const FLOW_ENTRIES = [
  { id: 'board-live', rule: 'Reihenfolge und Claim-Lage kommen aus GitHub, nicht aus lokalen Dateien', artifact: 'scripts/lib/github-rest.mjs' },
  { id: 'claim-gate', rule: 'ein Issue hat genau einen Halter; fremder Claim blockiert den Start', artifact: 'scripts/lib/issue-claim.mjs' },
  { id: 'actor-policy', rule: 'nur verifizierte Autoren aendern Board-Zustand', artifact: '.lane-claims/actors.json' },
];
const CONDITIONAL = new Map([
  ['install-webhook.mjs', 'klassischer Webhook braucht eine erreichbare Empfaenger-URL; seit FREEZE-0 gibt es keinen Ereignis-Workflow mehr, die Board-Pflege laeuft im Maintainer-Lauf'],
]);
const IGNORE = new Set(['github-rest-fetch.mjs', 'agent-start.mjs']);

function scanMechanics() {
  let scripts;
  try {
    scripts = readdirSync(join(ROOT, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
  } catch {
    return { wired: [], orphan: [], entries: [] };
  }
  const npm = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts ?? {};
  const references = new Map();
  const add = (file, source) => {
    if (!references.has(file)) references.set(file, []);
    if (!references.get(file).includes(source)) references.get(file).push(source);
  };
  for (const [name, command] of Object.entries(npm)) {
    for (const file of scripts) if (String(command).includes(`scripts/${file}`)) add(file, `npm:${name}`);
  }
  const workflowDir = join(ROOT, '.github', 'workflows');
  if (existsSync(workflowDir)) {
    for (const name of readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'))) {
      const text = readFileSync(join(workflowDir, name), 'utf8');
      for (const file of scripts) if (text.includes(`scripts/${file}`)) add(file, `workflow:${name}`);
    }
  }
  const hookDir = join(ROOT, '.githooks');
  if (existsSync(hookDir)) {
    for (const name of readdirSync(hookDir)) {
      const text = readFileSync(join(hookDir, name), 'utf8');
      for (const file of scripts) if (text.includes(`scripts/${file}`)) add(file, `hook:${name}`);
    }
  }
  // Verweise aus anderen Skripten zaehlen nur, wenn der Aufrufer selbst erreichbar ist.
  // Tests und Doku sind ebenfalls Aufrufer: getestete Pfade sind nicht vergessen,
  // nur nicht im Ablauf. Ohne diesen Pfad wuerde der Lauf gruene Suiten als
  // "vergessen" melden und Loeschungen provozieren.
  const knownText = [];
  const readTree = (directory) => {
    const full = join(ROOT, directory);
    if (!existsSync(full)) return;
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) readTree(path);
      else if (/\.(md|ts|tsx|mjs)$/.test(entry.name)) {
        const text = readFileSync(join(ROOT, path), 'utf8');
        if (text.includes('scripts/')) knownText.push(text);
      }
    }
  };
  readTree('src');
  readTree('docs');
  if (existsSync(join(ROOT, 'AGENTS.md'))) knownText.push(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8'));
  if (existsSync(join(ROOT, 'README.md'))) knownText.push(readFileSync(join(ROOT, 'README.md'), 'utf8'));
  const knownHay = knownText.join('\n');

  const calledBy = new Map();
  for (const file of scripts) {
    if (IGNORE.has(file)) continue;
    const text = readFileSync(join(ROOT, 'scripts', file), 'utf8');
    for (const other of scripts) {
      if (other === file) continue;
      if (text.includes(`'${other}'`) || text.includes(`"${other}"`) || text.includes(`./${other}`) || text.includes(`scripts/${other}`)) {
        if (!calledBy.has(other)) calledBy.set(other, []);
        calledBy.get(other).push(file);
      }
    }
  }
  const orphan = [];
  const unused = [];
  const wired = [];
  for (const file of scripts) {
    if (IGNORE.has(file)) continue;
    const sources = references.get(file) ?? [];
    if (sources.length > 0) wired.push({ file, sources });
    else if (CONDITIONAL.has(file)) wired.push({ file, sources: ['conditional'], note: CONDITIONAL.get(file) });
    else if ((calledBy.get(file) ?? []).some((caller) => (references.get(caller) ?? []).length > 0)) {
      wired.push({ file, sources: (calledBy.get(file) ?? []).map((caller) => `called-by:${caller}`) });
    } else if (knownHay.includes(`scripts/${file}`)) {
      unused.push({ file, note: 'nur aus Tests/Doku bekannt: wird nie ausgefuehrt — einbinden oder entfernen' });
    } else orphan.push({ file, note: 'niemand referenziert es' });
  }
  return { wired, unused, orphan, entries: FLOW_ENTRIES };
}

const mechanics = scanMechanics();
if (mechanics.unused.length > 0) {
  warnings.push(
    `${mechanics.unused.length} Mechanik(en) ohne Ausfuehrungspfad: ` +
      `${mechanics.unused.map((entry) => entry.file).join(', ')}; ` +
      'je Datei entscheiden: in den Ablauf einbinden oder als redundant entfernen',
  );
}
if (mechanics.orphan.length > 0) {
  blockers.push(
    `[ERR-4019] ${mechanics.orphan.length} vergessene(s) System(e) ohne Aufrufer: ` +
      `${mechanics.orphan.map((entry) => entry.file).join(', ')}; ` +
      'jede Datei wird eingebunden (package.json, Hook oder Workflow) oder entfernt — beides im selben Commit belegt',
  );
}

// --- 4b. APK-Relevanz (release-impact) -----------------------------------
// Eine Mechanik ohne Ausfuehrungspfad ist nutzlos: dieser Lauf fuehrt sie aus
// und zeigt, ob der Diff ueberhaupt ein APK rechtfertigt.
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

// --- 5. Naechste Schritte -------------------------------------------------
const claimBody = () =>
  `CLAIM [A1] ${agent} ${at} scope=<pfade> plan=<ein Satz, was dieses Issue erledigt>`;
const steps = [];
steps.push(...queueSteps);
if (next) {
  steps.push(`CLAIM im Issue setzen: gh issue comment ${next.number} --body "${claimBody()}"`);
  steps.push(`Lane-Branch: git switch -c fix/${next.number}-<slug> origin/main`);
  steps.push('Arbeit im Claim-Scope; vor dem Push `pnpm run verify:fast`');
  steps.push(`Uebergabe: push + PR gegen main, dann RELEASE [A1] done <sha> am Issue #${next.number}`);
} else if (board.ok) {
  steps.push('Kein freies Issue: Review/Blocker beim Maintainer, keine neue Lane');
}
if (mechanics.orphan.length > 0) steps.push('Vergessene Systeme einbinden oder entfernen (siehe Blocker)');
if (mechanics.unused.length > 0) steps.push(`Ohne Ausfuehrungspfad: ${mechanics.unused.map((entry) => entry.file).join(', ')} — einbinden oder entfernen`);
if (!policyMissing) steps.push('Nach dem Push: PR ueber `gh pr create` (oder Konnektor) oeffnen und Review anfordern; Board lokal nachziehen mit `pnpm run board:sync`');

// --- 7. Ausgabe -----------------------------------------------------------
if (asJson) {
  const payload = {
    ok: blockers.length === 0,
    repo,
    at,
    agent,
    tokenSource: credentials.source,
    board: {
      total: board.total,
      shown: board.rows.length,
      next: next ? next.number : null,
      rows: board.rows,
    },
    mechanics: {
      flow: mechanics.entries,
      wired: mechanics.wired,
      unused: mechanics.unused,
      orphan: mechanics.orphan,
    },
    pretask,
    mergeQueue,
    apkRelevance: apk,
    blockers,
    warnings,
    notes,
    nextSteps: brief ? [mergeQueue?.nextCommand].filter(Boolean) : steps,
    details: 'vollstaendig mit --json',
  };
  console.log(JSON.stringify(payload, null, 2));
} else {
  const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
  const claimCell = (claim) => {
    if (claim.status === 'claimed-other' || claim.status === 'claimed-self') return `${claim.holder} ${claim.claimId ?? ''}`.trim();
    if (claim.status === 'stale') return `stale (${claim.holder}, ${claim.ageHours}h)`;
    return claim.status;
  };
  console.log(`agent:start — ${repo} · Stand ${at} · Agent ${agent}`);
  console.log('');
  console.log('=== Board (GitHub, live) ===');
  console.log(`  Offen: ${board.total} Issues, ${board.pulls.length} PRs · gezeigt: ${board.rows.length} · frei: ${next ? `#${next.number}` : 'keins'}`);
  console.log('');
  console.log('  | # | Prio | Phase | Claim | PR | Naechster Akteur | Warum |');
  console.log('  | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of board.rows) {
    const pr = row.pr ? `#${row.pr.number}${row.pr.draft ? ' (draft)' : ''}` : '—';
    console.log(`  | #${row.number} | ${row.priority} | ${row.phase} | ${cell(claimCell(row.claim))} | ${pr} | ${cell(row.nextActor)} | ${cell(row.reasons.join(' · '))} |`);
  }
  console.log('');
  console.log('=== Start-Befund (pretask, im selben Lauf) ===');
  console.log(pretask.ran
    ? `  Modus ${pretask.mode ?? '?'} · Phase ${pretask.phase ?? '?'} · Claim ${pretask.claimState ?? '?'} · ${(pretask.blockers ?? []).length} Blocker`
    : `  nicht ausgewertet: ${pretask.reason}`);
  console.log('');
  console.log(`=== Merge-Queue (#${MERGE_ISSUE}) ===`);
  console.log(mergeQueue
    ? `  Plan ${mergeQueue.plan ? `${mergeQueue.plan.revision} (${mergeQueue.plan.hash})` : 'fehlt'} · Sessions ${mergeQueue.sessions.length} · READY ${mergeQueue.queue.filter((row) => row.status === 'READY').length}`
    : '  nicht gelesen: Board nicht lesbar');
  for (const row of mergeQueue?.queue ?? []) console.log(`  ${row.status} #${row.number} (${row.position || '—'}): ${cell(row.reasons.join(' · '))}`);
  console.log(`  Naechster Befehl: ${mergeQueue?.nextCommand ?? publishCommand()}`);
  console.log('');
  console.log('=== Mechaniken ===');
  for (const entry of mechanics.entries) console.log(`  FLOW   ${entry.id}: ${entry.rule}`);
  console.log(`  AUTO/WIRED: ${mechanics.wired.length} Skripte erreichbar · ohne Ablauf: ${mechanics.unused.length} · vergessen: ${mechanics.orphan.length}`);
  for (const entry of mechanics.wired.filter((item) => item.note)) console.log(`  HINWEIS ${entry.file}: ${entry.note}`);
  for (const entry of mechanics.unused) console.log(`  OHNE ABLAUF ${entry.file}: ${entry.note}`);
  for (const entry of mechanics.orphan) console.log(`  VERGESSEN ${entry.file}: ${entry.note}`);
  console.log(`  APK-Relevanz: ${apk.checked ? `${apk.apk ? 'APK empfohlen' : 'kein APK noetig'} (seit ${apk.prevTag})` : apk.reason}`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
  for (const note of notes) console.log(`  - ${note}`);
  console.log('');
  // `--brief` endet mit genau einer Aktion: der naechste Befehl, sonst der
  // erste Schritt. Alles weitere bleibt in `--json` vollstaendig erhalten.
  if (brief) {
    const nextAction = mergeQueue?.nextCommand ?? steps[0] ?? null;
    console.log('=== Naechste Aktion ===');
    console.log(`  -> ${nextAction ?? 'keine: Blockliste oben abarbeiten'}`);
  } else {
    console.log('=== Naechste Schritte ===');
    for (const step of steps) console.log(`  -> ${step}`);
  }
}

if (blockers.length > 0) {
  console.error('');
  console.error('agent:start: BLOCKIERT — jeder Punkt nennt den aufloesenden Befehl:');
  for (const blocker of blockers) console.error(`  - ${blocker}`);
  process.exit(1);
}
