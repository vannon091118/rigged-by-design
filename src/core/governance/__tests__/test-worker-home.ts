/**
 * Fixture-Identitaet und Pretask-Helfer fuer Tests, die `pretask` als
 * Kindprozess starten.
 *
 * Seit #605 ist eine fehlende Worker-Identitaet ein harter Blocker. Tests, die
 * echte Arbeit ohne Identitaet fahren, brauchen deshalb ein Workspace-Home mit
 * gueltiger `identity.json`; die Datei entsteht einmal pro Prozess in einem
 * Temp-Verzeichnis und wird ueber `RBD_WORKSPACE_HOME` durchgereicht.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let cached: string | null = null;

function home(): string {
  if (cached) return cached;
  const dir = mkdtempSync(join(tmpdir(), 'rbd-worker-home-'));
  mkdirSync(join(dir, '.lanes'), { recursive: true });
  writeFileSync(join(dir, '.lanes', 'identity.json'), `${JSON.stringify({
    schemaVersion: 1,
    identity: 'LIILITH',
    systemId: 'sys-test',
    workspaceId: 'ws-test',
    repository: 'vannon091118/rigged-by-design',
    sessionId: 'sess-test',
    claimId: 'idc-test',
    commentRef: 'https://example.invalid/604#issuecomment-1',
    reservedAt: '2026-11-14T00:00:00Z',
    activeIssue: null,
    branch: null,
    mainSha: '0000000',
    status: 'ACTIVE',
  }, null, 2)}\n`);
  cached = dir;
  return dir;
}

/** Env-Fragment fuer Spawns: gueltige Identitaet im Temp-Home. */
export function workerEnv(): NodeJS.ProcessEnv {
  return { RBD_WORKSPACE_HOME: home() };
}

export interface PretaskPayload {
  readonly ok: boolean;
  readonly context: string | null;
  readonly isolation: { readonly required: boolean; readonly code: string; readonly isWorktree: boolean; readonly reasons: readonly string[] };
  readonly blockers: readonly string[];
}

export const git = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

export const fixture = (parent: string, name: string): string => {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Test Agent']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  writeFileSync(join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  return dir;
};

export const writeClaim = (
  dir: string,
  branch: string,
  allowlist: readonly string[],
  dependencies: readonly string[] = [],
): void => {
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'actors.json'),
    `${JSON.stringify({ version: 1, maintainers: ['maintainer-fixture'], users: ['user-fixture'], workers: ['worker-fixture'] })}\n`,
  );
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([{
      id: 'lane/test/fixture',
      owner: 'Governance-Owner',
      branch,
      issue: 765,
      baseSha: '0'.repeat(40),
      task: 'Fixture-Aufgabe',
      pathAllowlist: allowlist,
      contracts: [],
      dependencies,
      gateProfile: 'light',
      status: 'open',
      createdAt: '0'.repeat(40),
    }], null, 2)}\n`,
  );
};

const writeContextStub = (dir: string): void => {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'scripts', 'agent-context.mjs'),
    "console.log(JSON.stringify({ systems: [], tests: { runAll: false, selected: [], fast: [], long: [] }, gates: [] }));\n",
  );
};

/** Ein Node-GH-Stub macht den Issue-Check auf jeder Plattform testbar. */
export const writeFakeGh = (
  parent: string,
  labels: readonly string[] = ['scope:lane:lane/test/issue'],
  body = '',
): { script: string } => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh-fixture.mjs');
  writeFileSync(script, `const args = process.argv.slice(2);
const issue = process.env.FAKE_GH_OPEN === '1' && args.includes('gate-failure');
if (args[1] === 'view') {
  console.log(JSON.stringify({
    number: 765,
    state: 'OPEN',
    labels: [{ name: 'zustand-OPEN' }],
    comments: [{
      id: 1,
      body: 'CLAIM [A1] agent-local 2026-11-14T00:00:00Z scope=README.md plan=Fixture-Lane',
      createdAt: '2026-11-14T00:00:00Z',
      author: { login: 'worker-fixture' },
    }],
  }));
} else {
  console.log(JSON.stringify(issue ? [{ number: 99, title: 'fixture gate', url: 'https://example.invalid/99', body: ${JSON.stringify(body)}, labels: ${JSON.stringify(labels.map((name) => ({ name })))} }] : []));
}
`);
  const file = join(bin, 'gh');
  writeFileSync(file, `#!/usr/bin/env node\n${readFileSync(script, 'utf8')}`);
  chmodSync(file, 0o755);
  return { script };
};

export const runPretask = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    // Die Zahl der in diesem Lauf geoeffneten Governance-Issues ist seit #752
    // belegt zu uebergeben; 0 ist bewusst kein gueltiger Beleg (#765).
    env: { ...process.env, ...workerEnv(), RBD_ROOT: cwd, RBD_NEW_GOVERNANCE_ISSUES: '1', ...env },
  });

export const cleanRepo = (
  parent: string,
  name: string,
  branch: string,
  dependencies: readonly string[] = [],
): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch, ['README.md'], dependencies);
  writeContextStub(repo);
  git(repo, ['add', '.lane-claims/claims.json', '.lane-claims/actors.json', 'scripts/agent-context.mjs']);
  git(repo, ['commit', '-q', '-m', 'pretask fixture']);
  return repo;
};

export const payloadOf = (stdout: string): PretaskPayload => JSON.parse(stdout) as PretaskPayload;
