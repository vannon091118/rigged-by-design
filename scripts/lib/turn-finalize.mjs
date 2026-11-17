/**
 * Der letzte Turn-Schritt: Claim-/Board-Preflight, Push, After-Task-Zustand
 * und optionaler PR-Kommentar. Kein Force-Push.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterTaskState, writeAfterTask } from '../task-state.mjs';
import { ROOT } from './report.mjs';

export function finalizeTurn({ git, gitRun, currentBranch, commitSha, afterTask, branchClaim, taskContract, fail }) {
  const preflight = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'claim-preflight.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (preflight.status !== 0) {
    fail(1, 'ERR-4019', 'turn:finish', 'Claim-Preflight rot: offener Rest-WIP oder Claim ohne Issue; kein Push');
    process.exit(1);
  }
  const boardGate = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'verify-board-usage.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (boardGate.status !== 0) {
    fail(1, 'ERR-4019', 'turn:finish', 'Issue-Board nicht belegt; kein Push. Erst CLAIM/RELEASE am Issue setzen.');
    process.exit(1);
  }
  const push = gitRun(['push', '-u', 'origin', 'HEAD']);
  if (push.status !== 0) {
    fail(1, 'ERR-4008', 'turn:finish', `Push auf ${currentBranch} fehlgeschlagen; kein Force-Push, der Commit bleibt lokal`);
    process.exit(1);
  }
  writeAfterTask({
    ...afterTask,
    state: afterTaskState({ gateOk: true, pushed: true }),
    next: [
      `PR wird erzeugt/aktualisiert; CI meldet fuer ${commitSha.slice(0, 7)}`,
      'naechster Schritt: pnpm run agent:pretask --json (Phase, Befunde, naechste Aktion)',
      'pnpm run task:complete --run <id> nach gruenem Lauf',
    ],
  });
  if (branchClaim && taskContract) {
    try {
      const body = [
        '<!-- rbd:task-contract -->',
        `### Task-Vertrag ${taskContract.taskId}`,
        '',
        `- Phase: \`${taskContract.phase}\``,
        `- Revision: ${taskContract.revision}`,
        `- Offene Befunde: ${(taskContract.findings ?? []).filter((finding) => finding.status === 'open').length}`,
        `- Naechster Schritt: ${taskContract.nextAction}`,
      ].join('\n');
      const dir = resolve(ROOT, git(['rev-parse', '--git-dir']));
      const commentFile = resolve(dir, 'TASK_CONTRACT_COMMENT.md');
      writeFileSync(commentFile, `${body}\n`, 'utf8');
      const view = spawnSync('gh', ['pr', 'view', currentBranch, '--json', 'number'], { cwd: ROOT, encoding: 'utf8' });
      const number = view.status === 0 ? JSON.parse(view.stdout).number : 0;
      if (number) {
        const edited = spawnSync('gh', ['pr', 'comment', String(number), '--edit-last', '--body-file', commentFile], { cwd: ROOT, stdio: 'ignore' });
        if (edited.status !== 0) spawnSync('gh', ['pr', 'comment', String(number), '--body-file', commentFile], { cwd: ROOT, stdio: 'ignore' });
      }
    } catch {
      // Der Kommentar ist Komfort; der Vertrag im Branch bleibt die Wahrheit.
    }
  }
  console.log(`turn:finish: PASS, ${currentBranch} gepusht. PR wird erzeugt/aktualisiert; CI meldet; naechster Schritt: PRETASK (pnpm run agent:pretask --json).`);
}
