/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Zwei Ebenen: die reine Entscheidung (geteilter Baum, fremder Claim,
 * eigener Worktree) und der echte `pretask`-Aufruf in temporaeren Git-Repos.
 * Der Aufruf ist der Vertrag; die Hilfsfunktion allein waere nur eine Absicht.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ISOLATION_CODE,
  assessIsolation,
  foreignClaimPaths,
  isLinkedWorktree,
  isolationRequired,
  parseStatusPaths,
} from '../../../../scripts/lib/worktree-isolation.mjs';

interface PretaskPayload {
  readonly ok: boolean;
  readonly branch: string;
  readonly isolation: {
    readonly code: string;
    readonly ok: boolean;
    readonly required: boolean;
    readonly isWorktree: boolean;
    readonly reasons: readonly string[];
    readonly dirtyPaths: readonly string[];
    readonly foreignPaths: readonly string[];
  };
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

const runPretask = (cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd, ...env },
  });

/** Der pretask-Start braucht einen Impact-Plan; in Fixtures ist das ein Stub. */
const writeContextStub = (dir: string): void => {
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'agent-context.mjs'), "console.log('context fixture');\n");
};

const payloadOf = (stdout: string): PretaskPayload => JSON.parse(stdout) as PretaskPayload;

describe('worktree-isolation', () => {
  it('blockt einen schmutzigen geteilten Arbeitsbaum', () => {
    const result = assessIsolation({
      required: true,
      isWorktree: false,
      dirtyPaths: ['src/dirty.ts'],
      branch: 'lane/test/shared',
    });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('shared-worktree');
    expect(result.reasons).toContain('dirty-shared-tree');
    expect(result.code).toBe(ISOLATION_CODE);
  });

  it('blockt fremde Claim-Pfade im geteilten Arbeitsbaum', () => {
    const claims = [
      { branch: 'lane/other/foreign', status: 'open', pathAllowlist: ['src/foreign.ts'] },
      { branch: 'lane/test/own', status: 'open', pathAllowlist: ['src/own.ts'] },
    ];
    const changed = ['src/foreign.ts', 'src/own.ts', 'README.md'];
    const foreign = foreignClaimPaths({ changed, claims, branch: 'lane/test/own' });
    const result = assessIsolation({
      required: true,
      isWorktree: false,
      dirtyPaths: changed,
      foreignPaths: foreign,
      branch: 'lane/test/own',
    });
    expect(foreign).toEqual(['src/foreign.ts']);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('foreign-claim-paths');
  });

  it('laesst einen sauberen verknuepften Worktree durch', () => {
    const result = assessIsolation({
      required: true,
      isWorktree: true,
      dirtyPaths: [],
      branch: 'lane/test/worktree',
    });
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(isLinkedWorktree('/repo/.git/worktrees/agent', '/repo/.git')).toBe(true);
    expect(isLinkedWorktree('/repo/.git', '/repo/.git')).toBe(false);
  });

  it('fordert Isolation bei einem fremden offenen Claim', () => {
    const claims = [
      { branch: 'lane/other/foreign', status: 'open', pathAllowlist: ['src/foreign.ts'] },
      { branch: 'lane/test/own', status: 'merged', pathAllowlist: ['src/own.ts'] },
    ];
    expect(isolationRequired({ claims, branch: 'lane/test/own' })).toBe(true);
    expect(isolationRequired({ explicit: true, claims: [], branch: 'lane/test/own' })).toBe(true);
    expect(isolationRequired({ claims: claims.slice(1), branch: 'lane/test/own' })).toBe(false);
  });

  it('liest auch umbenannte Pfade aus git status', () => {
    expect(parseStatusPaths(' M src/a.ts\nR  old.ts -> new.ts\n?? docs/x.md')).toEqual([
      'src/a.ts',
      'old.ts',
      'new.ts',
      'docs/x.md',
    ]);
  });

  it('refuses a dirty shared pretask start with ERR-4019', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-shared-'));
    try {
      const repo = fixture(parent, 'shared');
      mkdirSync(join(repo, 'src'), { recursive: true });
      writeFileSync(join(repo, 'src', 'dirty.ts'), 'export const dirty = 1;\n');
      const result = runPretask(repo, ['--require-worktree', '--json']);
      expect(result.status).toBe(1);
      const payload = payloadOf(result.stdout);
      expect(payload.ok).toBe(false);
      expect(payload.isolation.reasons).toContain('dirty-shared-tree');
      expect(payload.blockers.join('\n')).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt eine fremde Claim-Datei ohne Zusatzflag', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-foreign-'));
    try {
      const repo = fixture(parent, 'foreign');
      writeClaim(repo, 'lane/other/foreign', ['src/foreign.ts']);
      mkdirSync(join(repo, 'src'), { recursive: true });
      writeFileSync(join(repo, 'src', 'foreign.ts'), 'export const foreign = 1;\n');
      const result = runPretask(repo, ['--json']);
      expect(result.status).toBe(1);
      const payload = payloadOf(result.stdout);
      expect(payload.isolation.required).toBe(true);
      expect(payload.isolation.foreignPaths).toEqual(['src/foreign.ts']);
      expect(payload.isolation.reasons).toContain('foreign-claim-paths');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('laesst einen sauberen verknuepften pretask-Start durch', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-worktree-'));
    try {
      const main = fixture(parent, 'main');
      writeClaim(main, 'lane/test/pass', ['README.md']);
      writeContextStub(main);
      git(main, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
      git(main, ['commit', '-q', '-m', 'claim']);
      const worktree = join(parent, 'agent-worktree');
      git(main, ['worktree', 'add', '-q', '-b', 'lane/test/pass', worktree, 'HEAD']);
      const result = runPretask(worktree, ['--require-worktree', '--json']);
      expect(result.status).toBe(0);
      const payload = payloadOf(result.stdout);
      expect(payload.ok).toBe(true);
      expect(payload.isolation.isWorktree).toBe(true);
      expect(payload.isolation.reasons).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

});
