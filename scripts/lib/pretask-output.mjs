/**
 * Die eine Ausgabe von `pretask`: Kurzform fuer Agenten, vollstaendiges JSON
 * fuer Werkzeuge und Klartext fuer Menschen. Der Exit-Code bleibt hier, damit
 * kein zweiter Pfad ihn setzt.
 */
import { causeBlock } from '../agent-cause.mjs';
import { describeIssueClaim } from './issue-claim.mjs';
import { STATE_FILE } from './verify-state.mjs';

export function printPretask(ctx) {
  const {
    asJson, brief, blockers, mode, state, claimState, taskState, branch, base, head,
    claimInfo, issueClaim, worker, workGate, board, automation, contract, takeover,
    causes, warnings, notes, nextActions, checks, worktree, gitDir, commonDir, linked,
    baseRefresh, stagedPaths, unstagedPaths, untrackedPaths, issueCheck, issueResults,
    mergeBlocked, followUp, contextData, contextFile, isolation, cleanup, worktreePrune,
    agentIdentity, stateFile,
  } = ctx;

  if (asJson) {
    if (brief) {
      console.log(JSON.stringify({
        ok: blockers.length === 0,
        mode,
        state,
        claimState,
        taskStatus: taskState.status,
        phase: taskState.phase,
        branch,
        base,
        head,
        claim: claimInfo ? { id: claimInfo.id, owner: claimInfo.owner, status: claimInfo.status, paths: claimInfo.allowlist.length } : null,
        issueClaim: { status: issueClaim.status, number: issueClaim.number, holder: issueClaim.holder ?? null },
        worker: { role: worker.role, identity: worker.identity, status: worker.status, valid: worker.identityValid },
        workGate,
        board: board.items.map((item) => `#${item.number} ${item.priority}`),
        automation: automation.state,
        task: contract.task.id,
        paths: { own: contract.paths.ownWip.length, foreign: contract.paths.foreign.length, unowned: contract.paths.unowned.length, adopted: takeover.adopted, corrupted: takeover.blocked },
        blockers,
        ...(causes.length > 0 ? { causes: causes.map(({ gate, fix, repro }) => ({ gate, fix, repro })) } : {}),
        warnings,
        nextActions,
        details: 'vollstaendig mit --json; Ursachen mit pnpm run agent:cause',
      }, null, 2));
      // Die Kurzform ist die ganze Antwort; kein zweiter Vollblock dahinter.
      process.exit(blockers.length > 0 ? 1 : 0);
    } else console.log(JSON.stringify({
      ok: blockers.length === 0,
      mode,
      state,
      claimState,
      checks,
      branch,
      head,
      base,
      worktree,
      taskStatus: taskState.status,
      taskInfo: contract.taskState,
      automation,
      git: { dir: gitDir, commonDir, linked },
      baseRefresh,
      status: { staged: stagedPaths, unstaged: unstagedPaths, untracked: untrackedPaths },
      claim: claimInfo,
      issueClaim,
      board,
      issues: { ...issueCheck, issues: issueResults, mergeBlocked },
      mergeBlocked,
      followUp,
      context: contextData ? contextFile : null,
      isolation,
      takeover,
      reconcile: contract.reconcile,
      cleanup,
      worktreePrune,
      contract,
      taskState: STATE_FILE,
      blockers,
      causes,
      warnings,
      notes,
    }, null, 2));
  } else {
    console.log(`pretask: Branch ${branch} · Modus ${mode}`);
    console.log('');
    console.log('=== Issue-Check ===');
    console.log(`  Agent: ${agentIdentity}`);
    console.log(`  Issue-Claim: ${describeIssueClaim(issueClaim)}`);
    if (board.items.length > 0) console.log(`  Board: ${board.items.map((item) => `#${item.number} ${item.priority}`).join(' -> ')}`);
    if (!issueCheck.checked) console.log(`  nicht ausgefuehrt: ${issueCheck.errors.join(', ')}`);
    else if (issueResults.length === 0) console.log('  keine offenen gate-failure-, remote-ci- oder governance/blocked-Issues');
    else for (const issue of issueResults) console.log(`  #${issue.number} [${issue.scope.kind}${issue.scope.lane ? `:${issue.scope.lane}` : ''}] ${issue.disposition}: ${issue.title}`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
    for (const note of notes) console.log(`  - ${note}`);
    if (followUp.required) {
      console.log('');
      console.log('=== Folgetask-Gate ===');
      console.log(`  ${followUp.headline}`);
      for (const problem of followUp.problems) {
        console.log('');
        console.log(`  ${problem.title}${problem.number ? ` (${problem.number})` : ''}`);
        console.log(`  Kurzbeschreibung: ${problem.summary}`);
        console.log(`  Lösungsansatz: ${problem.approach}`);
        console.log(`  Schwierigkeitsgrad: ${problem.difficulty}`);
      }
      console.log('');
      console.log('  -> Diese Anfrage erst als Folgetask starten; keine neue Lane-Arbeit vorher.');
    }
    console.log('');
    console.log('=== Task-Vertrag ===');
    console.log(`  Status: ${taskState.status} · Phase ${taskState.phase} · offene Befunde: ${taskState.findings.length}`);
    console.log(`  Task: ${contract.task.id ?? '-'} / ${contract.task.description ?? '-'}`);
    console.log(`  Ziel: ${contract.task.goal || '-'}`);
    console.log(`  Worktree: ${worktree || '-'} (linked=${linked})`);
    console.log(`  Pfade erlaubt=${contract.paths.allowed.length} eigen=${contract.paths.ownWip.length} fremd=${contract.paths.foreign.length}`);
    console.log(`  WIP: ${takeover.total} adoptiert (${takeover.counts.compatible} kompatibel, ${takeover.counts.incomplete} unvollstaendig, ${takeover.counts.corrupted} korrupt)`);
    console.log(`  Systeme: ${contract.systems.join(', ') || 'keine'}`);
    console.log(`  Tests: ${contract.affectedTests.runAll ? 'vollstaendig' : contract.affectedTests.selected.length} · Long: ${contract.longTests.length} · Gates: ${contract.gates.length}`);
    for (const action of contract.nextActions) console.log(`  -> ${action}`);
    if (taskState.parallelLane?.suggested) console.log(`  Parallel: ${taskState.parallelLane.advice}`);
    if (causes.length > 0) {
      console.log('');
      console.log(causeBlock(causes));
    }
  }

  if (blockers.length > 0) {
    if (!asJson) {
      console.error('');
      console.error('pretask: STARTBLOCKER - erst aufloesen, dann neue Arbeit:');
      for (const blocker of blockers) console.error(`  - ${blocker}`);
    }
    process.exit(1);
  }

  if (!asJson) {
    console.log('');
    console.log(`pretask: ${state} (${claimState}) - neue Arbeit erlaubt.`);
    console.log(`  Zustand: ${stateFile}`);
    console.log('  Arbeit: pnpm run turn:finish fuehrt die betroffenen schnellen Tests aus; lange Nachweise uebernimmt CI.');
  }
}
