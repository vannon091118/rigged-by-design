/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Die Startmodi NEW, RESUME und NOOP sowie die Grenze zwischen eigener und
 * fremder WIP. Die Fixtures laufen gegen echte Git-Worktrees.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { ISOLATION_CODE } from '../../../../scripts/lib/worktree-isolation.mjs';

interface Payload {
  readonly ok: boolean;
  readonly mode: string;
  readonly state: string;
  readonly blockers: readonly string[];
  readonly contract: {
    readonly task: { readonly id: string; readonly description: string | null };
    readonly paths: { readonly allowed: readonly string[] };
    readonly requiredEvidence: readonly string[];
  };
}

const it = (name: string, fn: () => void): void => { vitestIt(name, fn, 15_000); };

const git = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

const fixture = (parent: string, name: string): string => {
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

const writeClaim = (dir: string, branch: string): void => {
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([{
      id: 'lane/test/fixture',
      owner: 'Governance-Owner',
      branch,
      baseSha: '0'.repeat(40),
      task: 'Fixture-Aufgabe',
      pathAllowlist: ['README.md'],
      contracts: [],
      dependencies: [],
      gateProfile: 'light',
      status: 'open',
      createdAt: '0'.repeat(40),
    }], null, 2)}\n`,
  );
};

const writeContext = (dir: string): void => {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'scripts', 'agent-context.mjs'),
    "console.log(JSON.stringify({ systems: [], tests: { runAll: false, selected: [], fast: [], long: [] }, gates: [] }));\n",
  );
};

const writeEmptyGh = (parent: string): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh.mjs');
  writeFileSync(script, "console.log('[]');\n");
  return script;
};

const run = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd, ...env },
  });

const claimRepo = (parent: string, name: string, branch: string): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch);
  writeContext(repo);
  git(repo, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(repo, ['commit', '-q', '-m', 'claim']);
  return repo;
};

const linkedRepo = (parent: string, name: string, branch: string): string => {
  const repo = claimRepo(parent, name, branch);
  git(repo, ['checkout', '-q', '-']);
  const worktree = join(parent, `${name}-worktree`);
  git(repo, ['worktree', 'add', '-q', worktree, branch]);
  return worktree;
};

const payload = (stdout: string): Payload => JSON.parse(stdout) as Payload;
const ghEnv = (parent: string): NodeJS.ProcessEnv => ({
  RBD_GH_BIN: process.execPath,
  RBD_GH_SCRIPT: writeEmptyGh(parent),
});

describe('pretask modes', () => {
  it('startet NEW im sauberen verknuepften Worktree', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-new-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/new');
      const result = run(worktree, ['--new', '--json'], ghEnv(parent));
      expect(result.status).toBe(0);
      const body = payload(result.stdout);
      expect(body.mode).toBe('NEW');
      expect(body.contract.task.id).toBe('lane/test/fixture');
      expect(body.contract.paths.allowed).toContain('README.md');
      expect(body.contract.requiredEvidence.length).toBeGreaterThan(0);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('setzt RESUME bei eigener WIP im verknuepften Worktree', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-resume-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/resume');
      writeFileSync(join(worktree, 'README.md'), '# own wip\n');
      const result = run(worktree, ['--resume', '--json'], ghEnv(parent));
      expect(result.status).toBe(0);
      expect(payload(result.stdout).mode).toBe('RESUME');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt fremde WIP ausserhalb des Claims', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-foreign-wip-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/foreign-wip');
      writeFileSync(join(worktree, 'dirty.ts'), 'export const dirty = 1;\n');
      const result = run(worktree, ['--json'], ghEnv(parent));
      expect(result.status).toBe(1);
      expect(payload(result.stdout).blockers.join('\n')).toContain('WIP ausserhalb');
      expect(payload(result.stdout).blockers.join('\n')).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt --resume ohne eigene WIP', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-resume-empty-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/resume-empty');
      const result = run(worktree, ['--resume', '--json'], ghEnv(parent));
      expect(result.status).toBe(1);
      expect(payload(result.stdout).blockers.join('\n')).toContain('--resume');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('meldet HEAD == Basis als NOOP statt als Startblocker', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-noop-'));
    try {
      const repo = claimRepo(parent, 'repo', 'lane/test/noop');
      git(repo, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      git(repo, ['checkout', '-q', '--detach', 'HEAD']);
      const worktree = join(parent, 'noop-worktree');
      git(repo, ['worktree', 'add', '-q', worktree, 'lane/test/noop']);
      const result = run(worktree, ['--json'], ghEnv(parent));
      expect(result.status).toBe(0);
      const body = payload(result.stdout);
      expect(body.mode).toBe('NOOP');
      expect(body.state).toBe('NOOP');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
