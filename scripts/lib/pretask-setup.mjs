/**
 * Startzustand: Actor-Policy, Git-Basis, Dirty-Pfade, lokale Claims und der
 * Issue-Claim. Das Board ist autoritativ; die lokale Sperre ist nur die
 * Pfad-Kollisionspruefung und blockiert einen gueltigen Issue-Claim nicht.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  botClaim, loadClaimsStrict, selectClaim,
} from './lane-claims.mjs';
import {
  isLinkedWorktree, parseStatusPaths,
} from './worktree-isolation.mjs';
import { refreshBase } from './base-refresh.mjs';
import { describeActorPolicy, normalizeActors } from './work-claim.mjs';
import { describeIssueClaim, issueNumberFor } from './issue-claim.mjs';
import { readIssueClaimAny } from './board-read.mjs';
import { readIdentityFile, workspacePaths } from './workspace-home.mjs';
import { ROOT } from './report.mjs';

/** Dieselbe Identitaetsquelle wie `agent:start`; ohne `RBD_AGENT` gilt die
 * reservierte Identitaet aus `.lanes/identity.json`. */
export function resolveAgentIdentity(argv, agentFlag) {
  let reserved;
  try {
    reserved = readIdentityFile(workspacePaths().identity)?.identity ?? '';
  } catch {
    reserved = '';
  }
  return process.env.RBD_AGENT || (agentFlag >= 0 ? argv[agentFlag + 1] : '') || reserved || 'agent-local';
}

export function runSetup(ctx) {
  const { branch: _ignored, ...rest } = ctx;
  void _ignored;
  const { agentIdentity, blockers, warnings, notes } = rest;

  // Actor-Policy (#693): Ein Kommentar autorisiert nur ueber seinen verifizierten
  // GitHub-Autor. Fehlt die Datei, ist keine Rolle zustaendig und jeder
  // Steuerbefehl bleibt fail-closed wirkungslos.
  const ACTORS_FILE = join(ROOT, '.lane-claims/actors.json');
  let actors = normalizeActors({});
  if (existsSync(ACTORS_FILE)) {
    try {
      actors = normalizeActors(JSON.parse(readFileSync(ACTORS_FILE, 'utf8')));
    } catch (error) {
      warnings.push(`Actor-Policy unlesbar (${String(error?.message ?? error).slice(0, 120)}); Kommentar-Ereignisse gelten fail-closed als unbekannt`);
    }
  } else {
    warnings.push('Actor-Policy fehlt (.lane-claims/actors.json); Kommentar-Ereignisse gelten fail-closed als unbekannt');
  }
  for (const finding of describeActorPolicy(actors)) warnings.push(`Actor-Policy: ${finding}`);

  const run = (args) => {
    try {
      return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const gitStrict = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const runOk = (args) => {
    try {
      execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  const pathList = (text) => (text ? text.split(/\r?\n/).filter(Boolean) : []);
  const isAncestor = (sha) => {
    if (!/^[0-9a-f]{40}$/.test(String(sha ?? ''))) return false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unbekannt)';
  const head = run(['rev-parse', 'HEAD']);
  const worktree = run(['rev-parse', '--show-toplevel']);
  const gitDir = run(['rev-parse', '--absolute-git-dir']);
  const commonDir = run(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const linked = isLinkedWorktree(gitDir, commonDir);
  // Erst die Basis, dann jeder Diff: `agent-context` und die Pfadpruefung lesen
  // denselben Ref; ohne Refresh rechnen sie gegen einen beliebig alten Stand.
  const baseRefresh = refreshBase({ cwd: ROOT });
  if (baseRefresh.moved) {
    notes.push(`Basis aktualisiert: ${baseRefresh.ref} ${baseRefresh.previous.slice(0, 7)} -> ${baseRefresh.sha.slice(0, 7)}`);
  } else if (baseRefresh.failed) {
    warnings.push(`Basis nicht aktualisiert (${baseRefresh.reason}); Diff gegen ${baseRefresh.ref} kann veraltete Pfade zeigen`);
  }
  const originMain = baseRefresh.sha || run(['rev-parse', '--verify', 'origin/main']);
  const mergeBase = originMain && head ? run(['merge-base', 'HEAD', originMain]) : '';

  const stagedPaths = pathList(run(['diff', '--cached', '--name-only']));
  const unstagedPaths = pathList(run(['diff', '--name-only']));
  const untrackedPaths = pathList(run(['ls-files', '--others', '--exclude-standard']));
  const rawDirtyPaths = parseStatusPaths(run(['status', '--porcelain=v1', '--untracked-files=all']));
  // Der eigene Zustandsbericht ist kein fremder Schmutz; .verify-cache ist
  // ausdruecklich fluechtig und darf den naechsten Pretask-Lauf nicht blockieren.
  const ignoredWip = (path) => path === '.turn-notes.md' || path.startsWith('.verify-cache/');
  const dirtyPaths = rawDirtyPaths.filter((path) => !ignoredWip(path));

  let allClaims = [];
  let claimRegisterError = '';
  try {
    allClaims = loadClaimsStrict();
  } catch (error) {
    claimRegisterError = error instanceof Error ? error.message : 'unbekannter Fehler';
    blockers.push(`[ERR-4019] Claim-Register nicht lesbar: ${claimRegisterError}`);
  }
  const claims = allClaims.filter((claim) => claim.status === 'open');
  // selectClaim fuehrt auch einen gemergten Claim auf seinem Branch weiter.
  const laneClaim = selectClaim(allClaims, branch);
  const claim = laneClaim ?? botClaim(branch);
  // Ein Worker haelt genau einen Claim. Mehrere offene Claims desselben Owners
  // sind keine Parallelitaet, sondern ungefuehrte Arbeit - und blockieren die
  // naechste echte Zuweisung an denselben Dateien.
  if (claim && claim.status === 'open' && branch !== 'main') {
    const parallelClaims = claims.filter((entry) => entry.owner === claim.owner && entry.branch !== branch);
    if (parallelClaims.length > 0) {
      blockers.push(
        `[ERR-4019] ${claim.owner} haelt ${parallelClaims.length} weiteren offenen Claim(s) ` +
          `(${parallelClaims.map((entry) => entry.id).join(', ')}); erst 'pnpm run claim:register release --id <id> --reason <text>' ` +
          'oder den stale-Audit ausfuehren',
      );
    }
  }
  const botBranch = laneClaim === null && claim !== null;
  const base = mergeBase || claim?.baseSha || '';
  const claimInfo = claim
    ? {
        id: claim.id,
        owner: claim.owner,
        branch: claim.branch,
        baseSha: claim.baseSha,
        status: claim.status,
        task: claim.task || '',
        goal: claim.goal || '',
        dependencies: claim.dependencies ?? [],
        allowlist: claim.pathAllowlist ?? [],
        contracts: claim.writeContracts(),
      }
    : null;

  // Das Issue-Board ist die Wahrheit ueber Besitz und Reihenfolge; `.lane-claims/`
  // ist nur die lokale Kollisionssperre fuer Pfade. Deshalb steht die
  // Issue-Pruefung vor der Sperre, und eine fehlende Sperre blockiert einen
  // gueltigen Issue-Claim nicht: sie wird zur Warnung.
  const boardNumber = claim ? issueNumberFor(claim) : issueNumberFor({ branch });
  const issueClaim = branch !== 'main' && boardNumber
    ? readIssueClaimAny({ number: boardNumber, agent: agentIdentity, cwd: ROOT, actors })
    : { checked: false, status: 'not-linked', number: null };
  // Dieselbe Regel wie validateNewClaim: eine offene Lane ohne Issue-Nummer hat
  // keinen Board-Auftrag und startet nicht (#635).
  if (branch !== 'main' && claim && claim.status === 'open' && !boardNumber) {
    blockers.push(`[ERR-4019] Claim '${claim.id}' traegt keine Issue-Nummer; neue Lanes brauchen eine positive Issue-Referenz (pnpm run claim:register --issue <nr>)`);
  }
  if (branch !== 'main') {
    if (issueClaim.status === 'claimed-other') {
      blockers.push(`[ERR-4019] ${describeIssueClaim(issueClaim)}; erst RELEASE/HANDOFF im Issue abwarten, kein paralleler Read`);
    } else if (issueClaim.status === 'free') {
      blockers.push(`[ERR-4019] ${describeIssueClaim(issueClaim)}; vor dem ersten Read 'gh issue comment ${issueClaim.number} --body "CLAIM [A1] ${agentIdentity} <UTC> scope=<pfade> plan=<ein Satz>"' setzen`);
    } else if (issueClaim.status === 'stale') {
      warnings.push(`${describeIssueClaim(issueClaim)}; als deferred notieren und ueberspringen`);
    } else if (issueClaim.status === 'unknown') {
      // Fail-closed: ohne lesbaren Verlauf ist der Claim nicht belegt. Frueher war
      // das nur eine Warnung - damit konnte eine Lane mit selbst geschriebener
      // Claim-Datei starten, ohne das Issue je zu benutzen. Eine gemergte Lane
      // ist davon ausgenommen: ihr Beleg wurde beim Merge erbracht, Closeout
      // braucht keinen zweiten Claim.
      if (claim?.status === 'merged') {
        notes.push(`${describeIssueClaim(issueClaim)}; Lane ist gemergt, Closeout ohne neuen Board-Beleg`);
      } else {
        blockers.push(
          `[ERR-4019] ${describeIssueClaim(issueClaim)}; 'gh auth login' oder Token (GH_TOKEN/GITHUB_TOKEN) einrichten, ` +
            'danach pnpm run verify:board-usage gruen stellen',
        );
      }
    }
  }
  if (branch !== 'main' && !claim) {
    if (issueClaim.status === 'claimed-self') {
      warnings.push(`lokale Kollisionssperre fuer '${branch}' fehlt; mit 'pnpm run claim:register --issue ${issueClaim.number}' nachziehen (der Issue-Claim ist autoritativ)`);
    } else if (issueClaim.status === 'not-linked' || issueClaim.status === 'unknown') {
      // Ohne lesbares Board ist die lokale Sperre der einzige Mechanismus: fail-closed.
      blockers.push(`[ERR-4019] kein Issue-Claim und keine lokale Kollisionssperre fuer '${branch}'; zuerst im Issue claimen, dann 'pnpm run claim:register --issue <nr>'`);
    }
  }
  if (branch === 'main' && !claim) notes.push('main ist durch den Branch-Schutz gedeckt; keine Lane noetig.');

  return {
    actors, run, gitStrict, runOk, pathList, isAncestor, branch, head, worktree, gitDir, commonDir,
    linked, baseRefresh, originMain, mergeBase, stagedPaths, unstagedPaths, untrackedPaths, dirtyPaths,
    allClaims, claimRegisterError, claims, laneClaim, claim, botBranch, base, claimInfo, boardNumber, issueClaim,
  };
}
