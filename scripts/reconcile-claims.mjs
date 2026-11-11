#!/usr/bin/env node
/**
 * Claim-Reconciliation: Claims muessen zum tatsaechlichen Remote-Zustand passen.
 *
 * Ein Claim auf einen geloeschten Branch oder ein bereits gemergter Stand ist
 * keine Sperre, sondern eine Luege im Register. Der Merge-Nachweis kommt aus
 * `scripts/lib/claim-evidence.mjs`: gemergter PR, Branch-Kopf auf `main` oder
 * ein baumgleicher Commit auf `main` aus der lokalen Historie. Ein Basis-SHA
 * ist **kein** Nachweis - er liegt per Definition auf `main` und wuerde jeden
 * geloeschten Branch als gemergt ausgeben.
 *
 * Die Entscheidung selbst liegt in `planReconcile`; `pretask` ruft dieselbe
 * Funktion lesend auf. Geschrieben wird nur hier mit `--apply`.
 *
 * Nach dem Claim-Beleg laufen zwei Lifecycle-Schritte:
 * - `planTaskCloseout` zieht Tasks mit gemergtem Claim von CI_PENDING,
 *   MERGE_PENDING oder AFTERCARE auf DONE.
 * - `planRetention` haelt die letzten zehn Tasks; aktive Tasks, offene Claims
 *   und die gerade bearbeitete Lane bleiben immer erhalten.
 *
 * Aufruf: `node scripts/reconcile-claims.mjs [--apply] [--json] [--check]`
 * Ohne `--apply` wird nur berichtet; mit `--apply` wird das Register atomar
 * ueber `saveClaims` geschrieben, inklusive Belegart und Beleg-Commit. Exit 1
 * nur mit `--check` und offener Abweichung oder unbelegtem Befund.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { planReconcile } from './lib/claim-evidence.mjs';
import { claimEntryPath, planRetention, planTaskCloseout } from './lib/claim-lifecycle.mjs';
import { loadClaimsStrict, saveClaims } from './lib/lane-claims.mjs';
import { loadTaskContracts, writeTaskContract } from './lib/task-contract.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const json = argv.includes('--json');
const check = argv.includes('--check');

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const branch = (() => {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return '';
  }
})();
const commitTime = (file) => {
  try {
    return Number(git(['log', '-1', '--format=%ct', '--', file])) || 0;
  } catch {
    return 0;
  }
};

const claims = loadClaimsStrict();
const { changes, unresolved } = planReconcile({ claims, git });

const taskLoad = loadTaskContracts();
if (taskLoad.errors.length > 0) {
  for (const error of taskLoad.errors) console.error(`reconcile-claims: ${error}`);
  process.exit(1);
}

for (const change of changes) {
  change.claim.status = change.status;
  change.claim.mergedEvidence = change.evidence;
  change.claim.mergedSha = change.sha;
}
const claimViews = claims.map((claim) => (typeof claim.toJSON === 'function' ? claim.toJSON() : claim));
const taskChanges = planTaskCloseout({ tasks: taskLoad.tasks, claims: claimViews });
const updatedTasks = taskLoad.tasks.map((task) => {
  const change = taskChanges.find((entry) => entry.file === task.file);
  return change ? { ...task, contract: change.contract } : task;
});

const claimFiles = new Map(
  claims
    .map((claim) => [claim.id, claimEntryPath(claim.id)])
    .filter(([, file]) => file && existsSync(join(ROOT, file))),
);
const protectedClaimIds = claims.filter((claim) => claim.branch === branch).map((claim) => claim.id);
const protectedTaskFiles = updatedTasks
  .filter((task) => task.contract.branch === branch || protectedClaimIds.includes(task.contract.claimId))
  .map((task) => task.file);
const retention = planRetention({
  tasks: updatedTasks.map((task) => ({ ...task, committedAt: commitTime(task.file) })),
  claims: claims.map((claim) => ({
    file: claimFiles.get(claim.id) ?? null,
    claim: typeof claim.toJSON === 'function' ? claim.toJSON() : claim,
    committedAt: commitTime(claimFiles.get(claim.id) ?? ''),
  })),
  protectedClaimIds,
  protectedTaskFiles,
});

const removals = [...retention.removeTasks, ...retention.removeClaims];
if (changes.length === 0 && taskChanges.length === 0 && removals.length === 0 && unresolved.length === 0) {
  console.log('reconcile-claims: keine Abweichung');
  process.exit(0);
}

for (const change of changes) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.id} -> ${change.status} (${change.why})`);
}
for (const change of taskChanges) {
  console.log(`${apply ? 'setze' : 'wuerde setzen'}: ${change.file} -> DONE (${change.claimId})`);
}
for (const file of retention.removeTasks) console.log(`${apply ? 'entferne' : 'wuerde entfernen'}: ${file} (Retention)`);
for (const file of retention.removeClaims) console.log(`${apply ? 'entferne' : 'wuerde entfernen'}: ${file} (Retention)`);
for (const entry of unresolved) console.log(`unbelegt: ${entry.id} (${entry.why})`);

if (json) {
  process.stdout.write(
    `${JSON.stringify(
      {
        changes: changes.map((change) => ({
          id: change.id,
          status: change.status,
          evidence: change.evidence,
          sha: change.sha,
          why: change.why,
        })),
        tasks: taskChanges.map((change) => ({ file: change.file, claimId: change.claimId, phase: change.contract.phase })),
        retention,
        unresolved,
      },
      null,
      2,
    )}\n`,
  );
}
if (apply) {
  saveClaims(claims);
  for (const change of taskChanges) {
    if (!retention.removeTasks.includes(change.file)) writeTaskContract(change.file, change.contract);
  }
  for (const file of removals) {
    try {
      unlinkSync(join(ROOT, file));
    } catch {
      // Eine bereits entfernte Datei ist kein zweiter Fehler.
    }
  }
  console.log(
    `reconcile-claims: ${changes.length} Claim(s) aktualisiert, ${taskChanges.length} Task(s) geschlossen, ${removals.length} Datei(en) per Retention entfernt`,
  );
}
if (check && !apply) process.exit(1);
