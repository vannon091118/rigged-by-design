/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Der echte `pretask`-Start in temporaeren Git-Repos. Die Isolation-Hilfe
 * liefert den Fehlercode; die Fixtures pruefen die Startblocker.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { ISOLATION_CODE } from '../../../../scripts/lib/worktree-isolation.mjs';

interface PretaskPayload {
  readonly ok: boolean;
  readonly isolation: { readonly required: boolean; readonly isWorktree: boolean; readonly reasons: readonly string[] };
  readonly blockers: readonly string[];
}

// Git-Worktrees brauchen auf Windows gelegentlich laenger als das Default-Limit.
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

const writeClaim = (
  dir: string,
  branch: string,
  allowlist: readonly string[],
  dependencies: readonly string[] = [],
): void => {
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([{
      id: 'lane/test/fixture',
      owner: 'Governance-Owner',
      branch,
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
const writeFakeGh = (
  parent: string,
  labels: readonly string[] = ['scope:lane:lane/test/issue'],
  body = '',
): { script: string } => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh-fixture.mjs');
  writeFileSync(script, `const args = process.argv.slice(2);
const issue = process.env.FAKE_GH_OPEN === '1' && args.includes('gate-failure');
console.log(JSON.stringify(issue ? [{ number: 99, title: 'fixture gate', url: 'https://example.invalid/99', body: ${JSON.stringify(body)}, labels: ${JSON.stringify(labels.map((name) => ({ name })))} }] : []));
`);
  const file = join(bin, 'gh');
  writeFileSync(file, `#!/usr/bin/env node\n${readFileSync(script, 'utf8')}`);
  chmodSync(file, 0o755);
  return { script };
};

const runPretask = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd, ...env },
  });

const cleanRepo = (
  parent: string,
  name: string,
  branch: string,
  dependencies: readonly string[] = [],
): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch, ['README.md'], dependencies);
  writeContextStub(repo);
  git(repo, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(repo, ['commit', '-q', '-m', 'pretask fixture']);
  return repo;
};

const payloadOf = (stdout: string): PretaskPayload => JSON.parse(stdout) as PretaskPayload;

describe('pretask start blockers', () => {
  it('blockt einen schmutzigen eigenen Worktree vor dem ersten Edit', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-dirty-own-'));
    try {
      const main = fixture(parent, 'main');
      writeClaim(main, 'lane/test/dirty', ['README.md']);
      writeContextStub(main);
      git(main, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
      git(main, ['commit', '-q', '-m', 'claim']);
      const worktree = join(parent, 'dirty-worktree');
      git(main, ['worktree', 'add', '-q', '-b', 'lane/test/dirty', worktree, 'HEAD']);
      writeFileSync(join(worktree, 'dirty.ts'), 'export const dirty = 1;\n');
      const fake = writeFakeGh(parent);
      const result = runPretask(worktree, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status).toBe(1);
      expect(payloadOf(result.stdout).blockers.join('\n')).toContain('Arbeitsbaum nicht leer');
      expect(payloadOf(result.stdout).blockers.join('\n')).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt ein offenes gate-failure-Issue', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-issue-'));
    try {
      const repo = cleanRepo(parent, 'repo', 'lane/test/issue');
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
        FAKE_GH_OPEN: '1',
      });
      expect(result.status).toBe(1);
      expect(payloadOf(result.stdout).blockers.join('\n')).toContain('gate-failure');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt einen fehlenden Impact-Plan', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-context-'));
    try {
      const repo = fixture(parent, 'repo');
      git(repo, ['checkout', '-q', '-b', 'lane/test/context']);
      writeClaim(repo, 'lane/test/context', ['README.md']);
      git(repo, ['add', '.lane-claims/claims.json']);
      git(repo, ['commit', '-q', '-m', 'claim without context']);
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status).toBe(1);
      expect(payloadOf(result.stdout).blockers.join('\n')).toContain('Impact-Plan fehlt');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt eine saubere Lane im geteilten Arbeitsbaum', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-shared-lane-'));
    try {
      const repo = cleanRepo(parent, 'repo', 'lane/test/shared');
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status).toBe(1);
      const payload = payloadOf(result.stdout);
      expect(payload.isolation.required).toBe(true);
      expect(payload.isolation.isWorktree).toBe(false);
      expect(payload.isolation.reasons).toContain('shared-worktree');
      expect(payload.blockers.join('\n')).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
