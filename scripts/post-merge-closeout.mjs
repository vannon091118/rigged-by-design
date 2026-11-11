#!/usr/bin/env node
/**
 * Post-Merge-Closeout: nach einem Merge den Registerstand nachziehen.
 *
 * Der Workflow `pr-cleanup.yml` ruft dieses Skript nach jedem gemergten PR auf.
 * Es sucht den Claim des Heads, setzt ihn auf `merged`, schliesst den Task auf
 * `DONE`, wendet die 10-Task-Retention an und legt fuer die Aenderung einen
 * eigenen Closeout-PR an. Der Closeout-PR traegt `closeout: post-merge`; nur
 * dieser ausdrueckliche Pfad darf mit `DONE` durch `promote` mergen.
 *
 * Idempotent: existiert der Closeout-Branch bereits oder ist der Task schon
 * DONE, endet der Lauf ohne Commit. Das Skript schreibt nie auf `main`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { IDENTITY } from './lib/identity.mjs';
import { claimEntryPath, planRetention, planTaskCloseout } from './lib/claim-lifecycle.mjs';
import { loadClaimsStrict, LaneClaim, saveClaims } from './lib/lane-claims.mjs';
import { loadTaskContracts, validateTaskContract, writeTaskContract } from './lib/task-contract.mjs';
import { ROOT } from './lib/report.mjs';

const repo = process.env.GITHUB_REPOSITORY ?? '';
const number = Number(process.env.MERGED_PR_NUMBER ?? 0);
const headRef = process.env.MERGED_HEAD_REF ?? '';
const headSha = process.env.MERGED_HEAD_SHA ?? '';
const mergeSha = process.env.MERGE_SHA ?? '';
const token = process.env.GH_TOKEN ?? '';
const log = (message) => console.log(`post-merge: ${message}`);

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitRun = (args) =>
  execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });
const gh = (args) =>
  execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commitTime = (file) => {
  try {
    return Number(git(['log', '-1', '--format=%ct', '--', file])) || 0;
  } catch {
    return 0;
  }
};
const writeClaimFile = (claim) => {
  const file = claimEntryPath(claim.id);
  if (!file) throw new Error(`Claim-ID '${claim.id}' ergibt keinen Dateinamen`);
  const target = join(ROOT, file);
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.new`;
  writeFileSync(temp, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
  renameSync(temp, target);
  return file;
};

if (!number || !headRef || !headSha || !mergeSha || !repo) {
  log('kein vollstaendiger Merge-Kontext; nichts zu tun');
  process.exit(0);
}

git(['fetch', 'origin', 'main']);
const mainSha = git(['rev-parse', 'origin/main']);
const claims = loadClaimsStrict();
const featureClaim = claims.find((claim) => claim.branch === headRef);
if (!featureClaim) {
  log(`kein Claim fuer ${headRef}; nichts zu tun`);
  process.exit(0);
}
const featureFile = claimEntryPath(featureClaim.id);
if (!existsSync(join(ROOT, featureFile))) {
  log(`${featureClaim.id} liegt nur im Legacy-Register; Retention fasst es nicht an`);
  process.exit(0);
}
const taskLoad = loadTaskContracts();
if (taskLoad.errors.length > 0) {
  for (const error of taskLoad.errors) console.error(`post-merge: ${error}`);
  process.exit(1);
}
const featureTasks = taskLoad.tasks.filter((task) => task.contract.claimId === featureClaim.id);
if (featureClaim.status === 'merged' && featureTasks.every((task) => task.contract.phase === 'DONE')) {
  log(`${featureClaim.id} ist bereits merged/DONE; nichts zu tun`);
  process.exit(0);
}

const branch = `lane/governance/post-merge-${number}`;
const remote = git(['ls-remote', '--heads', 'origin', branch]);
if (remote) {
  log(`${branch} existiert bereits; nichts zu tun`);
  process.exit(0);
}

// Den Feature-Vertrag mit dem echten PR belegen, bevor der Task schliesst.
for (const task of featureTasks) {
  task.contract = {
    ...task.contract,
    pr: {
      number,
      url: `https://github.com/${repo}/pull/${number}`,
      state: 'merged',
      headSha,
      mergedSha: mergeSha,
    },
  };
}
featureClaim.status = 'merged';
featureClaim.mergedEvidence = 'post-merge-closeout';
featureClaim.mergedSha = mergeSha;
const featureView = featureClaim.toJSON();
const taskChanges = planTaskCloseout({
  tasks: taskLoad.tasks,
  claims: claims.map((claim) => (claim.id === featureClaim.id ? featureView : claim.toJSON())),
});

gitRun(['checkout', '-B', branch, 'origin/main']);

const claimFiles = new Map(
  claims
    .map((claim) => [claim.id, claimEntryPath(claim.id)])
    .filter(([, file]) => file && existsSync(join(ROOT, file))),
);
const closeoutClaim = new LaneClaim({
  id: branch,
  owner: 'Governance-Owner',
  branch,
  baseSha: mainSha,
  task: `Post-Merge-Closeout #${number}`,
  goal: `Pending-Claim und Task-Vertrag aus PR #${number} nach dem Merge automatisch schliessen.`,
  pathAllowlist: ['.lane-claims/'],
  gateProfile: 'light',
  status: 'merged',
});
closeoutClaim.mergedEvidence = 'post-merge-closeout';
closeoutClaim.mergedSha = mergeSha;
const closeoutTaskFile = `.lane-claims/tasks/governance-post-merge-${number}.json`;
const closeoutTask = {
  version: 1,
  taskId: `governance-post-merge-${number}`,
  claimId: branch,
  branch,
  baseSha: mainSha,
  phase: 'DONE',
  title: `Post-Merge-Closeout #${number}`,
  goal: `Register und Task-Vertrag nach dem Merge von PR #${number} automatisch nachziehen.`,
  taskType: 'aftercare',
  closeout: 'post-merge',
  holdMerge: false,
  status: 'READY_FOR_MERGE',
  pr: null,
  findings: [],
  nextAction: 'Automatisch nach Merge geschlossen; Closeout-PR wird von PR Cleanup angelegt.',
  revision: 1,
};

const closeoutValidation = validateTaskContract(closeoutTask, {
  claim: closeoutClaim.toJSON(),
  branch,
});
if (!closeoutValidation.ok) {
  for (const violation of closeoutValidation.violations) console.error(`post-merge: ${violation}`);
  process.exit(1);
}

const updatedTasks = taskLoad.tasks.map((task) => {
  const change = taskChanges.find((entry) => entry.file === task.file);
  return change ? { ...task, contract: change.contract } : task;
});
const allTasks = [
  ...updatedTasks,
  {
    file: closeoutTaskFile,
    contract: closeoutTask,
    // Der neue Closeout ist der neueste geschlossene Task und belegt einen
    // der zehn Plaetze; die uebrigen neun kommen aus der Historie.
    committedAt: Number.MAX_SAFE_INTEGER,
  },
];
const claimEntries = [
  ...claims.map((claim) => ({
    file: claimFiles.get(claim.id) ?? null,
    claim: claim.id === featureClaim.id ? featureView : claim.toJSON(),
    committedAt: 0,
  })),
  { file: claimEntryPath(closeoutClaim.id), claim: closeoutClaim.toJSON(), committedAt: 0 },
];
const retention = planRetention({
  tasks: allTasks.map((task) => ({ ...task, committedAt: task.committedAt ?? commitTime(task.file) })),
  claims: claimEntries,
  protectedTaskFiles: [closeoutTaskFile],
  protectedClaimIds: [closeoutClaim.id],
});

saveClaims(claims);
for (const change of taskChanges) {
  if (!retention.removeTasks.includes(change.file)) writeTaskContract(change.file, change.contract);
}
if (!retention.removeTasks.includes(closeoutTaskFile)) writeTaskContract(closeoutTaskFile, closeoutTask);
writeClaimFile(closeoutClaim.toJSON());
for (const file of [...retention.removeTasks, ...retention.removeClaims]) {
  try {
    unlinkSync(join(ROOT, file));
  } catch {
    // Eine bereits entfernte Datei ist kein zweiter Fehler.
  }
}

gitRun(['add', '-A', '--', '.lane-claims']);
const staged = git(['diff', '--cached', '--name-only']);
if (!staged) {
  log('keine Registeraenderung; kein Closeout-PR');
  process.exit(0);
}

const body = [
  `Post-Merge-Closeout fuer PR #${number}.`,
  '',
  '### Changes (Was ist neu)',
  `- Claim \`${featureClaim.id}\` steht auf \`merged\`, der zugehoerige Task auf \`DONE\`.`,
  `- Die Lane-Claims und Task-Vertraege sind auf die letzten zehn Tasks retention-begrenzt.`,
  '',
  '### Technische Basis & Kausalität',
  `- PR #${number} wurde als \`${mergeSha.slice(0, 7)}\` nach \`main\` gemergt; der Beleg ist der Merge-Commit, nicht die Basis.`,
  '- Der Closeout-Task traegt `closeout: post-merge`; nur dieser Pfad darf als DONE-PR durch `promote` mergen.',
  '',
  '### Ausblick (Nächste Schritte)',
  '- CI prueft diesen Closeout-PR; danach merged ihn `promote` wie jede andere gruene Lane.',
  '',
].join('\n');
const gitDir = git(['rev-parse', '--git-dir']);
const messageFile = isAbsolute(gitDir) ? join(gitDir, 'POST_MERGE_MSG') : join(ROOT, gitDir, 'POST_MERGE_MSG');
writeFileSync(messageFile, `${body}\n`, 'utf8');
git(['-c', `user.name=${IDENTITY.name}`, '-c', `user.email=${IDENTITY.email}`, 'commit', '-F', messageFile]);
gitRun(['push', '-u', 'origin', `HEAD:${branch}`]);

if (!token) {
  log(`Branch ${branch} gepusht; GH_TOKEN fehlt, Closeout-PR muss manuell angelegt werden`);
  process.exit(0);
}
const existing = gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'open', '--json', 'number']);
if (JSON.parse(existing).length > 0) {
  log(`Closeout-PR fuer ${branch} existiert bereits`);
  process.exit(0);
}
const title = `Post-Merge-Closeout #${number}: Pending-Tasks schliessen`;
const url = gh(['pr', 'create', '--repo', repo, '--base', 'main', '--head', branch, '--title', title, '--body-file', messageFile]);
log(`Closeout-PR angelegt: ${url}`);
