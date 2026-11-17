/**
 * WIP und Isolation: Jede Dirty-Datei wird klassifiziert und als eigene Arbeit
 * angenommen; nur Korruption haelt den Start an. Ein geteilter Worktree ist
 * der Normalfall, Isolation wird nur auf Wunsch erzwungen.
 */
import {
  ISOLATION_CODE, assessIsolation, foreignClaimPaths, isolationRequired,
} from './worktree-isolation.mjs';
import { parseWorktrees, planCleanup } from './branch-lifecycle.mjs';
import { TAKEOVER_CODE, classifyWip, summarizeTakeover } from './takeover.mjs';
import { allowsPath, isTaskContractPath } from './lane-claims.mjs';
import { readAfterTask, resumeDecision, resumeTask } from '../task-state.mjs';

export function runWip(ctx) {
  const {
    branch, head, base, originMain, claim, claims, dirtyPaths, run, runOk, pathList,
    blockers, notes, requireWorktree, wantNew, wantResume,
  } = ctx;

  // Phase 3: Jede Branch ausser `main` ist temporaer. `pretask` raeumt nur
  // administrative Worktree-Reste auf; Branches loescht ausschliesslich der
  // Lifecycle-Lauf nach belegtem Merge.
  const worktreesBefore = parseWorktrees(run(['worktree', 'list', '--porcelain']));
  const mergedLocal = new Set(originMain ? pathList(run(['branch', '--merged', originMain, '--format=%(refname:short)'])) : []);
  const cleanup = planCleanup({
    branches: pathList(run(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])).map((name) => ({
      name,
      merged: mergedLocal.has(name),
    })),
    worktrees: worktreesBefore,
    current: branch,
  });
  const worktreePrune = { ran: runOk(['worktree', 'prune']), pruned: cleanup.prune.length };
  if (cleanup.prune.length > 0) notes.push(`Worktree-Reconcile: ${cleanup.prune.length} verwaiste Eintrag(e) geprunt.`);
  if (cleanup.delete.length > 0) {
    notes.push(`Temporaere Branches mit Merge-Beleg: ${cleanup.delete.slice(0, 8).join(', ')}; Entfernen folgt im Lane-Finish/CI.`);
  }

  const foreignPaths = foreignClaimPaths({ changed: dirtyPaths, claims, branch, ownAllowlist: claim?.pathAllowlist ?? [] });
  const ownWipPaths = claim ? dirtyPaths.filter((path) => claim.allowsPath(path) || isTaskContractPath(path)) : [];
  const outsideClaim = dirtyPaths.filter((path) => !claim || (!allowsPath(claim.pathAllowlist, path) && !isTaskContractPath(path)));
  const unownedPaths = outsideClaim.filter((path) => !foreignPaths.includes(path));

  // Phase 2: "Fremdes WIP" gibt es nicht. Jede Dirty-Datei wird klassifiziert
  // und als eigene Arbeit angenommen; nur Korruption haelt den Start an.
  const takeoverEntries = dirtyPaths
    .map((path) => classifyWip({ path, claims, branch, allowlist: claim?.pathAllowlist ?? [] }))
    .filter(Boolean);
  const takeover = summarizeTakeover(takeoverEntries);
  for (const item of takeoverEntries.filter((entry) => entry.kind === 'corrupted')) {
    blockers.push(`[${TAKEOVER_CODE}] korrupte WIP: ${item.path} (${item.reason}); nicht automatisch uebernehmen`);
  }

  const isolation = {
    ...assessIsolation({
      required: isolationRequired({ explicit: requireWorktree, claims, branch }),
      isWorktree: ctx.linked,
      dirtyPaths,
      foreignPaths,
      branch,
    }),
    ownWipPaths,
    unownedPaths,
  };
  if (!isolation.ok) {
    blockers.push(`[${ISOLATION_CODE}] isolation: ${isolation.reasons.join(', ')}; dirty=${dirtyPaths.length} foreign=${foreignPaths.join(',') || '(keine)'}`);
  }
  const dirtyAdoptable = dirtyPaths.length > 0 && takeover.blocked === 0;
  let mode;
  let resumed = null;
  if (wantResume && blockers.length === 0) {
    const decision = resumeDecision({ record: readAfterTask(), branch, claim, isWorktree: ctx.linked, dirtyPaths });
    if (decision.ok) {
      resumeTask({ record: readAfterTask(), branch, claim, isWorktree: ctx.linked, dirtyPaths });
      resumed = decision.state;
      if (resumed) notes.push(`Resume: Zustand ${resumed} wiederhergestellt.`);
    } else {
      blockers.push(`[ERR-4019] Resume nicht moeglich: ${decision.reasons.join('; ')}`);
    }
  }

  if (blockers.length > 0) mode = 'BLOCKED';
  else if (branch === 'main') mode = 'GLOBAL';
  else if (head && base && head === base) mode = 'NOOP';
  else if (dirtyAdoptable) mode = 'RESUME';
  else mode = 'NEW';

  if (wantNew && wantResume) blockers.push('[ERR-4019] --new und --resume schliessen sich aus');
  if (wantNew && mode !== 'NEW' && mode !== 'NOOP') blockers.push(`[ERR-4019] --new verlangt einen sauberen, isolierten NEW-Start (aktuell ${mode})`);
  if (wantResume && mode !== 'RESUME') blockers.push(`[ERR-4019] --resume verlangt eigene WIP im verknuepften Worktree (aktuell ${mode})`);
  if (blockers.length > 0) mode = 'BLOCKED';

  return { worktreePrune, cleanup, foreignPaths, ownWipPaths, unownedPaths, takeover, isolation, mode, resumed };
}
