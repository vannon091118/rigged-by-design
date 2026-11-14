/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Issue-Scopes blockieren nur die betroffene Lane. `remote-ci` und Issues ohne
 * Scope bleiben Warnungen; ein bereits erreichter Repair-Marker ebenfalls.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { ISOLATION_CODE } from '../../../../scripts/lib/worktree-isolation.mjs';
import { workerEnv } from './test-worker-home';

interface Payload {
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

const it = (name: string, fn: () => void): void => { vitestIt(name, fn, 40_000); };

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

const writeClaim = (dir: string, branch: string, dependencies: readonly string[] = []): void => {
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
      dependencies,
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

const writeFakeGh = (
  parent: string,
  labels: readonly string[],
  body = '',
): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh.mjs');
  writeFileSync(script, `const args = process.argv.slice(2);
const issue = process.env.FAKE_GH_OPEN === '1' && args.includes('gate-failure');
console.log(JSON.stringify(issue ? [{ number: 99, title: 'fixture gate', url: 'https://example.invalid/99', body: ${JSON.stringify(body)}, labels: ${JSON.stringify(labels.map((name) => ({ name })))} }] : []));
`);
  return script;
};

const run = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...workerEnv(), RBD_ROOT: cwd, ...env },
  });

const linkedRepo = (parent: string, name: string, branch: string, dependencies: readonly string[] = []): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch, dependencies);
  writeContext(repo);
  git(repo, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(repo, ['commit', '-q', '-m', 'claim']);
  git(repo, ['checkout', '-q', '-']);
  const worktree = join(parent, `${name}-worktree`);
  git(repo, ['worktree', 'add', '-q', worktree, branch]);
  return worktree;
};

const payload = (stdout: string): Payload => JSON.parse(stdout) as Payload;

describe('pretask issue scopes', () => {
  it('blockt scope:main global', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-scope-main-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/scope-main');
      const script = writeFakeGh(parent, ['scope:main']);
      const result = run(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: script,
        FAKE_GH_OPEN: '1',
      });
      expect(result.status).toBe(1);
      const blocker = payload(result.stdout).blockers.join('\n');
      expect(blocker).toContain('scope:main');
      expect(blocker).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt eine Dependency-Scope nur in abhaengigen Lanes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-dependency-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/dependency', ['lane/base']);
      const script = writeFakeGh(parent, ['scope:dependency:lane/base']);
      const result = run(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: script,
        FAKE_GH_OPEN: '1',
      });
      expect(result.status).toBe(1);
      expect(payload(result.stdout).blockers.join('\n')).toContain('Dependency lane/base');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('ignoriert remote-ci und Issues ohne Scope als Blocker', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-scope-warning-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/scope-warning');
      const remote = writeFakeGh(parent, ['remote-ci', 'scope:main']);
      const remoteResult = run(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: remote,
        FAKE_GH_OPEN: '1',
      });
      expect(remoteResult.status).toBe(0);
      expect(payload(remoteResult.stdout).warnings.join('\n')).toContain('remote-ci');

      const unscoped = writeFakeGh(parent, []);
      const unscopedResult = run(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: unscoped,
        FAKE_GH_OPEN: '1',
      });
      expect(unscopedResult.status).toBe(0);
      expect(payload(unscopedResult.stdout).warnings.join('\n')).toContain('ohne Scope');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('behandelt einen bereits erreichten Repair-Marker als Warnung', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-repair-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/repair');
      const head = git(worktree, ['rev-parse', 'HEAD']);
      const script = writeFakeGh(parent, ['scope:main'], `<!-- repair: ${head} -->`);
      const result = run(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: script,
        FAKE_GH_OPEN: '1',
      });
      expect(result.status).toBe(0);
      const body = payload(result.stdout);
      expect(body.warnings.join('\n')).toContain('Repair-SHA');
      expect(body.blockers.join('\n')).not.toContain('scope:main');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
