/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Der echte `pretask`-Start in temporaeren Git-Repos. Die Isolation-Hilfe
 * liefert den Fehlercode; die Fixtures pruefen die neuen Startblocker:
 * schmutziger Baum, offenes gate-failure-Issue und fehlender Impact-Plan.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ISOLATION_CODE } from '../../../../scripts/lib/worktree-isolation.mjs';

interface PretaskPayload {
  readonly ok: boolean;
  readonly blockers: readonly string[];
}

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

const writeClaim = (dir: string, branch: string, allowlist: readonly string[]): void => {
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([
      {
        id: 'lane/test/fixture',
        owner: 'Governance-Owner',
        branch,
        baseSha: '0'.repeat(40),
        pathAllowlist: allowlist,
        contracts: [],
        dependencies: [],
        gateProfile: 'light',
        status: 'open',
        createdAt: '0'.repeat(40),
      },
    ], null, 2)}\n`,
  );
};

const writeContextStub = (dir: string): void => {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'agent-context.mjs'), "console.log('context fixture');\n");
};

/** Ein GH-Stub macht den Issue-Check ohne Login testbar. */
const writeFakeGh = (parent: string): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const file = join(bin, 'gh');
  writeFileSync(file, `#!/usr/bin/env node
const args = process.argv.slice(2);
const issue = process.env.FAKE_GH_OPEN === '1' && args.includes('gate-failure');
console.log(JSON.stringify(issue ? [{ number: 99, title: 'fixture gate', url: 'https://example.invalid/99', labels: [] }] : []));
`);
  chmodSync(file, 0o755);
  return bin;
};

const runPretask = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd, ...env },
  });

const cleanRepo = (parent: string, name: string, branch: string): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch, ['README.md']);
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
      const result = runPretask(worktree, ['--json']);
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
      const bin = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
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
      const bin = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      });
      expect(result.status).toBe(1);
      expect(payloadOf(result.stdout).blockers.join('\n')).toContain('Impact-Plan fehlt');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
