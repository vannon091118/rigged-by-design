#!/usr/bin/env node
/** Turn-Abschluss: betroffene Tests, verify:light, Commit und Push auf den Arbeitsbranch. Kein Auto-Rebase, kein Force-Push; der PR wird durch promote gemergt. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { bumpPatch } from './version-bump.mjs';
import { announceVersion } from './lib/turn-version.mjs';
import { IDENTITY } from './lib/identity.mjs';
import { claimForBranch } from './lib/lane-claims.mjs';
import {
  loadTaskContractForClaim,
  makeTaskContract,
  readPullRequestState,
  transitionTaskContract,
  validateTaskContract,
  writeTaskContract,
} from './lib/task-contract.mjs';
import { stageChanges } from './lib/turn-staging.mjs';
import { prepareCommitMessage } from './lib/turn-commit.mjs';
import { afterTaskState } from './task-state.mjs';
import { finalizeTurn } from './lib/turn-finalize.mjs';
import { clearSection, readSection } from './lib/verify-state.mjs';
import { causeBlock, causeForGate, localCauses } from './agent-cause.mjs';
import { fail, ROOT } from './lib/report.mjs';
import { captureConsole } from './lib/compact.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const gitRun = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const npmRun = (args) =>
  spawnSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
/** Roter Befund mit derselben Gate/Fix/Repro-Zeile wie `agent:cause`. */
const showCause = (findings) => {
  const block = causeBlock(findings);
  if (block) console.error(`\n${block}`);
};

// Light bleibt der schnellste Turn. Fast ist der lokale Standard vor dem
// Push: Light plus Testqualitaet, betroffene Tests und Build. Integration ist
// der volle Nachweis vor dem Merge; Audit und Langlaeufe bleiben separat.
// Breiter pruefen: `--profile=fast`, `--profile=integration` oder
// `--profile=full` (verify:all, lokal die Ausnahme).
const args = process.argv.slice(2);
const profileArg = args.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'light';
// Turn-Bericht bleibt unter 500 Token; Kindlaeufe schreiben ihre Logs selbst.
captureConsole({ label: 'turn-finish' });
if (!['light', 'fast', 'dev', 'quick', 'integration', 'full'].includes(PROFILE)) {
  fail(1, 'ERR-4024', 'turn:finish', `unbekanntes Profil ${PROFILE}; erlaubt sind light, fast, dev, quick, integration und full`);
  process.exit(1);
}
const VERIFY_SCRIPT = PROFILE === 'full' ? 'verify:all' : `verify:${PROFILE}`;
// Standard ist der lokale Preflight ohne Tests und ohne Typecheck: die CI
// prueft den gepushten Kopf. `--tests` und `--verify` sind das ausdrueckliche
// Opt-in; quick/full bleiben die breiteren Opt-ins.
const RUN_AFFECTED = !args.includes('--no-tests') && (args.includes('--tests') || PROFILE !== 'light');
const RUN_VERIFY = !args.includes('--no-verify') && (args.includes('--verify') || PROFILE !== 'light');

// main ist PR-Ziel, nie Agent-Arbeitsbranch. Ein Turn auf main bricht hier ab,
// statt in den Branch-Schutz zu laufen und den Commit lokal liegen zu lassen.
const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch === 'main') {
  fail(1, 'ERR-4023', 'turn:finish', 'main ist PR-Ziel; auf einer Lane arbeiten (git switch -c lane/<domäne>/<task>)');
  process.exit(1);
}
const branchClaim = claimForBranch(currentBranch);
// Der Vertrag ist die Wahrheit; fehlt er, entsteht er beim ersten Turn aus
// dem Claim. Die Phasenpruefung laeuft gegen den im HEAD committeten Stand.
const contractLoad = branchClaim ? loadTaskContractForClaim(branchClaim) : { contract: null, file: null, error: null };
if (contractLoad.error) {
  fail(1, 'ERR-4019', 'turn:finish', contractLoad.error);
  process.exit(1);
}
let taskContract = contractLoad.contract;
if (branchClaim && !taskContract) {
  taskContract = makeTaskContract(branchClaim, {
    baseSha: git(['merge-base', 'HEAD', `origin/${'main'}`]) || branchClaim.baseSha,
    nextAction: 'Erste Aenderung im Claim-Scope; danach turn:finish ohne Flags.',
  });
}
if (branchClaim && taskContract) {
  const contractCheck = validateTaskContract(taskContract, { claim: branchClaim, branch: currentBranch });
  if (!contractCheck.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Task-Vertrag ungueltig: ${contractCheck.violations.join('; ')}`);
    process.exit(1);
  }
}
let delegated = [];
if (!resumePending && !SKIP_AFFECTED) {
  console.log('turn:finish: betroffene schnelle Tests vor dem Versions-Bump');
  // Eine alte Delegationsliste darf einen Turn ohne lange Nachweise nicht
  // faelschlich als "offen" melden.
  clearSection('delegated');
  const affected = npmRun(['run', 'test:affected']);
  if (affected.status !== 0) {
    fail(1, 'ERR-4026', 'turn:finish', 'betroffene Tests sind rot; kein Commit und kein Push');
    showCause([causeForGate('affected')]);
    process.exit(1);
  }
  delegated = readSection('delegated')?.tests ?? [];
  if (delegated.length > 0) {
    console.log(`turn:finish: ${delegated.length} lange Nachweis(e) offen; CI führt sie auf dem PR-Commit aus`);
    for (const test of delegated) console.log(`  offen: ${test}`);
  }
}
announceVersion({ git, schmutz, bumpPatch });

// Marker und Inventar VOR der Pruefung setzen: der Docs-Gate prueft
// INVENTORY-Abdeckung gegen git ls-files. Eigene Dateien muessen zuerst im
// Index stehen, sonst fehlen sie der Inventur und verify:docs blockiert den
// Task vor seinem regulären Staging-Schritt.
if (!resumePending) stageChanges({ git, branch: currentBranch, paths, fail });
if (!resumePending && paths.length > 0) {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs', '--staged'], { cwd: ROOT, stdio: 'ignore' });
} else if (!resumePending) {
  spawnSync(process.execPath, ['scripts/doc-sync.mjs'], { cwd: ROOT, stdio: 'ignore' });
}
if (!resumePending) {
  spawnSync(process.execPath, ['scripts/build-inventory.mjs'], { cwd: ROOT, stdio: 'ignore' });
  git(['add', '--', 'docs/INVENTORY.md']);
  const dependencyMatrix = spawnSync(process.execPath, ['scripts/sync-dependency-matrix.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (dependencyMatrix.status !== 0) {
    fail(1, 'ERR-4013', 'turn:finish', 'Dependency-Matrix konnte nicht synchronisiert werden; kein Commit und kein Push');
    process.exit(1);
  }
  git(['add', '--', 'docs/DEPENDENCY-MATRIX.md']);
}

if (RUN_VERIFY) {
  const verify = npmRun(['run', VERIFY_SCRIPT]);
  if (verify.status !== 0) {
    fail(1, 'ERR-4024', 'turn:finish', `${VERIFY_SCRIPT} ist rot; kein Commit und kein Push`);
    showCause(localCauses());
    process.exit(1);
  }
} else {
  console.log('turn:finish: kein lokales verify (CI prueft den Push); --verify erzwingt den Light-Lauf');
}
// Der Push ist die Uebergabe an die CI. Der Vertrag wechselt deshalb erst
// hier nach CI_PENDING; der Phasenwechsel wird gegen den HEAD-Stand geprueft.
if (!resumePending && branchClaim && taskContract) {
  const prState = readPullRequestState({ branch: currentBranch });
  const pr = prState.known && prState.number
    ? { number: prState.number, url: prState.url, state: prState.state, headSha: prState.headSha }
    : taskContract.pr;
  const transition = transitionTaskContract(
    taskContract,
    'CI_PENDING',
    {
      pr,
      nextAction: 'PR wird erzeugt/aktualisiert; CI meldet; nächster Schritt: PRETASK.',
    },
    { previous: contractLoad.contract },
  );
  if (!transition.ok) {
    fail(1, 'ERR-4019', 'turn:finish', `Phasenwechsel ungueltig: ${transition.violations.join('; ')}`);
    process.exit(1);
  }
  taskContract = transition.contract;
  writeTaskContract(contractLoad.file, taskContract);
  git(['add', '--', contractLoad.file]);
  console.log(`turn:finish: Task-Vertrag ${taskContract.phase} (Revision ${taskContract.revision})`);
}
if (!resumePending) stageChanges({ git, branch: currentBranch, paths, fail });
const staged = git(['diff', '--cached', '--name-only']);
// Ein früherer Lauf kann einen Commit erzeugt haben, der den Push nicht mehr geschafft hat.
// Ohne diesen Zweig würde der nächste Lauf "keine Aenderungen" melden und den Commit
// stillschweigend liegen lassen.
const offen = Number(git(['rev-list', '--count', `origin/${'main'}..HEAD`]));
if (!staged) {
  if (offen === 0) {
    console.log('turn:finish: keine Aenderungen zu committen');
    process.exit(0);
  }
  console.log(`turn:finish: ${offen} Commit(s) warten noch auf den Push; kein neuer Commit noetig`);
}

let files = [];
if (!resumePending) {
  files = staged.split(/\r?\n/).filter(Boolean);
  console.log(`turn:finish: ${files.length} Datei(en) gestaged`);
  const { messageFile, notesPath } = prepareCommitMessage({ git, files, fail });
  git(['-c', `user.name=${IDENTITY.name}`, '-c', `user.email=${IDENTITY.email}`, 'commit', '-F', messageFile]);
  if (existsSync(notesPath)) {
    rmSync(notesPath, { force: true });
    console.log('turn:finish: .turn-notes.md verbraucht');
  }
  console.log(`turn:finish: Commit ${git(['rev-parse', '--short', 'HEAD'])} erstellt`);
}
const baseSha = (() => {
  try {
    return git(['merge-base', 'HEAD', `origin/${'main'}`]);
  } catch {
    return branchClaim?.baseSha ?? '';
  }
})();
const commitSha = git(['rev-parse', 'HEAD']);
const afterTask = {
  state: afterTaskState({ gateOk: true, pushed: false }),
  branch: currentBranch,
  head: commitSha,
  base: baseSha,
  claim: branchClaim ? { id: branchClaim.id, owner: branchClaim.owner, branch: branchClaim.branch } : null,
  own: files,
  foreign: [],
  tests: { profile: RUN_VERIFY ? PROFILE : 'none', script: RUN_VERIFY ? VERIFY_SCRIPT : null, affected: RUN_AFFECTED, delegated },
  gate: { ok: true, profile: RUN_VERIFY ? PROFILE : 'none', script: RUN_VERIFY ? VERIFY_SCRIPT : null },
  next: [`git push -u origin ${currentBranch}`, 'PR wird erzeugt/aktualisiert; CI meldet; naechster Schritt: PRETASK'],
};
writeAfterTask(afterTask);

integrator.ensureIntegrated(currentBranch);

finalizeTurn({ git, gitRun, currentBranch, commitSha, afterTask, branchClaim, taskContract, fail });
process.exit(0);
