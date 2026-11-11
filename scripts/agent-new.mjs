#!/usr/bin/env node
/**
 * Agenten-Bootstrap: ein Startvorgang statt vier.
 *
 *   node scripts/agent-new.mjs --id lane/<domäne>/<task> --owner <Roster-Name> \
 *        --task "<Ziel>" --allow <pfad,pfad> [--goal "<Warum>"] [--json] [--dry-run]
 *
 * Der Lauf legt Branch und verknuepften Worktree an, registriert den Claim,
 * schreibt den Task-Vertrag in Phase `READY` und startet `pretask` in genau
 * diesem Worktree. Er automatisert nur die Vorbereitung: jede Sicherheitspruefung
 * (Claim-Schema, Isolation, Issue-Check, Freeze) laeuft unveraendert.
 *
 * Claim und Vertrag bleiben bewusst uncommittet: der erste `turn:finish` des
 * Agenten committet sie mit der ersten inhaltlichen Aenderung. Damit braucht
 * der Bootstrap keine Freeze-Freigabe und legt keinen Governance-Commit ohne
 * Pruefzweck an.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { parseAgentNewArgs } from './lib/agent-new-args.mjs';
import { makeTaskContract, contractRelativePath, writeTaskContract } from './lib/task-contract.mjs';

const args = process.argv.slice(2);
const { has, values, arg } = parseAgentNewArgs(args);

const AS_JSON = has('json');
const DRY = has('dry-run');
const ID = arg('id');
const OWNER = arg('owner');
const TASK = arg('task');
const GOAL = arg('goal') ?? '';
const ALLOW = values('allow');
const BASE = arg('base') ?? 'origin/main';
const WORKTREE = arg('worktree') ?? resolve(ROOT, '..', `${basename(ROOT)}-${String(ID ?? 'lane').replace(/[^a-z0-9]+/gi, '-')}`);

const fail = (message, code = 1) => {
  console.error(`agent:new: ${message}`);
  process.exit(code);
};

if (!ID || !OWNER || !TASK || ALLOW.length === 0) {
  fail('--id, --owner, --task und mindestens ein --allow sind Pflicht (--help im Kopf der Datei)');
}

const git = (list, cwd = ROOT) => execFileSync('git', list, { cwd, encoding: 'utf8' }).trim();
const tryGit = (list, cwd = ROOT) => spawnSync('git', list, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const status = git(['status', '--porcelain']);
if (status) fail('Arbeitsbaum nicht sauber; Bootstrap startet nur aus einem sauberen Stand (fremde WIP bleibt liegen)');
if (tryGit(['rev-parse', '--verify', `refs/heads/${ID}`], ROOT).status === 0) fail(`Branch ${ID} existiert bereits`);
if (existsSync(WORKTREE)) fail(`Worktree-Pfad existiert bereits: ${WORKTREE}`);

/** Die Basis muss existieren; ohne `origin/main` (frisches lokales Repo) ist
 * `HEAD` die einzige belegte Basis. */
const resolvedBase = (() => {
  for (const candidate of [BASE, 'HEAD']) {
    const probe = tryGit(['rev-parse', '--verify', `${candidate}^{commit}`], ROOT);
    if (probe.status === 0) return { ref: candidate, sha: String(probe.stdout).trim() };
  }
  fail(`Basis ${BASE} nicht aufloesbar; kein Worktree ohne Basis`);
  return null;
})();

const plan = {
  id: ID,
  owner: OWNER,
  task: TASK,
  goal: GOAL,
  allow: ALLOW,
  base: resolvedBase.ref,
  baseSha: resolvedBase.sha,
  worktree: WORKTREE,
  branch: ID,
};

if (DRY) {
  console.log(JSON.stringify({ ok: true, dryRun: true, plan }, null, 2));
  process.exit(0);
}

// 1. Branch und verknuepfter Worktree: Isolation ist keine Empfehlung, sondern
//    die Voraussetzung fuer den Pretask-Start.
try {
  git(['worktree', 'add', '-b', ID, WORKTREE, resolvedBase.sha], ROOT);
} catch (error) {
  fail(`Worktree konnte nicht angelegt werden: ${String(error?.stderr ?? error?.message ?? error).slice(0, 300)}`);
}

// 2. Claim im neuen Worktree registrieren — dasselbe Schema und derselbe
//    Pruefer wie beim manuellen Aufruf.
const claimRun = spawnSync(
  process.execPath,
  [
    resolve(ROOT, 'scripts', 'claim-register.mjs'),
    'add',
    '--id', ID,
    '--owner', OWNER,
    '--branch', ID,
    '--task', TASK,
    ...(GOAL ? ['--goal', GOAL] : []),
    ...ALLOW.flatMap((entry) => ['--allow', entry]),
    '--json',
  ],
  { cwd: WORKTREE, encoding: 'utf8' },
);
if (claimRun.status !== 0) {
  fail(`Claim nicht registriert (Exit ${claimRun.status}): ${String(claimRun.stderr ?? '').trim().slice(0, 300)}`);
}
const claim = JSON.parse(claimRun.stdout).claim;

// 3. Task-Vertrag in Phase READY; committet wird er vom ersten turn:finish.
const contract = makeTaskContract(claim, {
  baseSha: resolvedBase.sha,
  nextAction: 'Arbeit im Claim-Scope starten; Abschluss ueber pnpm run turn:finish.',
});
const contractPath = contractRelativePath(contract.taskId);
mkdirSync(join(WORKTREE, contractPath, '..'), { recursive: true });
writeTaskContract(contractPath, contract, { root: WORKTREE });

// 4. Pakete aus dem Lockfile bereitstellen, bevor der Impact-Kontext laeuft.
// Ein leerer Worktree hat keine node_modules; den Agenten mit einem undiagnostischen
// Impact-Plan-Fehler starten zu lassen, macht aus normalem Bootstrap einen Loop.
if (!existsSync(join(WORKTREE, 'node_modules'))) {
  const install = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: WORKTREE,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (install.status !== 0) {
    fail(`Abhaengigkeiten konnten nicht aus pnpm-lock.yaml installiert werden. Nach Behebung erneut ausfuehren: pnpm install --frozen-lockfile (Worktree ${WORKTREE})`);
  }
}

// 5. Pretask im neuen Worktree: derselbe Startblocker-Pfad wie ohne Bootstrap.
const pretask = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'pretask.mjs'), '--json'], {
  cwd: WORKTREE,
  encoding: 'utf8',
  env: { ...process.env, RBD_ROOT: WORKTREE },
});
let pretaskState;
try {
  pretaskState = JSON.parse(pretask.stdout);
} catch {
  pretaskState = null;
}

const summary = {
  ok: pretask.status === 0,
  branch: ID,
  worktree: WORKTREE,
  claim: { id: claim.id, owner: claim.owner, paths: claim.pathAllowlist },
  contract: contractRelativePath(contract.taskId),
  phase: contract.phase,
  pretask: pretaskState
    ? { ok: pretaskState.ok, mode: pretaskState.mode, state: pretaskState.state, blockers: pretaskState.blockers, mergeBlocked: pretaskState.mergeBlocked ?? null }
    : { ok: false, error: 'pretask lieferte kein JSON' },
  next: [
    `cd ${/\s/.test(WORKTREE) ? `"${WORKTREE}"` : WORKTREE}`,
    'im Claim-Scope arbeiten; Abschluss: pnpm run turn:finish',
    'erster turn:finish committet Claim und Task-Vertrag mit',
  ],
};

if (AS_JSON) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`agent:new: ${ID} bereit (${contract.phase})`);
  console.log(`  Worktree: ${WORKTREE}`);
  console.log(`  Claim: ${claim.id} (${claim.pathAllowlist.length} Pfad(e))`);
  console.log(`  Pretask: ${summary.pretask.state ?? 'unbekannt'}${summary.pretask.mergeBlocked ? ' · Merge gesperrt' : ''}`);
  if (pretaskState?.blockers?.length) {
    console.log('  Blocker:');
    for (const blocker of pretaskState.blockers) console.log(`    - ${blocker}`);
  }
}
process.exit(pretask.status === 0 ? 0 : 1);
