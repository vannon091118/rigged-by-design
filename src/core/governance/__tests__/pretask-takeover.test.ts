/**
 * @test-target: scripts/lib/takeover.mjs
 * @error-code: ERR-4019
 *
 * Der echte `pretask`-Start mit adoptierbarer und korrupter WIP. Fremde oder
 * unvollstaendige Aenderungen werden als eigene Arbeit angenommen; nur
 * Governance ohne Freigabe und kritische Zustandspfade halten an.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { TAKEOVER_CODE } from '../../../../scripts/lib/takeover.mjs';

interface Payload {
  readonly mode: string;
  readonly state: string;
  readonly blockers: readonly string[];
  readonly contract: {
    readonly paths: {
      readonly takeover: {
        readonly counts: { readonly compatible: number; readonly incomplete: number; readonly corrupted: number };
      };
    };
  };
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

const linkedRepo = (parent: string, name: string, branch: string): string => {
  const repo = fixture(parent, name);
  git(repo, ['checkout', '-q', '-b', branch]);
  writeClaim(repo, branch);
  writeContext(repo);
  git(repo, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(repo, ['commit', '-q', '-m', 'claim']);
  git(repo, ['checkout', '-q', '-']);
  const worktree = join(parent, `${name}-worktree`);
  git(repo, ['worktree', 'add', '-q', worktree, branch]);
  return worktree;
};

const run = (cwd: string, parent: string) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), '--json'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd, RBD_GH_BIN: process.execPath, RBD_GH_SCRIPT: writeEmptyGh(parent) },
  });

const payloadOf = (stdout: string): Payload => JSON.parse(stdout) as Payload;

describe('pretask takeover', () => {
  it('adoptiert eigenes und fremdes Dirty im Claim-Scope', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-takeover-adopt-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/adopt');
      writeFileSync(join(worktree, 'dirty.ts'), 'export const dirty = 1;\n');
      const result = run(worktree, parent);
      expect(result.status).toBe(0);
      const body = payloadOf(result.stdout);
      expect(body.mode).toBe('RESUME');
      expect(body.state).toBe('SCOPE_VALID');
      expect(body.blockers).toEqual([]);
      expect(body.contract.paths.takeover.counts.incomplete).toBe(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockt einen kritischen Zustandspfad als korrupt', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-takeover-ledger-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/ledger');
      mkdirSync(join(worktree, 'src', 'core', 'economy'), { recursive: true });
      writeFileSync(join(worktree, 'src', 'core', 'economy', 'ledger.ts'), 'export const ledger = 1;\n');
      const result = run(worktree, parent);
      expect(result.status).toBe(1);
      const body = payloadOf(result.stdout);
      expect(body.mode).toBe('BLOCKED');
      expect(body.blockers.join('\n')).toContain(TAKEOVER_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('nimmt Governance ohne Claim als unvollstaendig an', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-takeover-freeze-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/freeze');
      writeFileSync(join(worktree, 'AGENTS.md'), '# ohne Freigabe\n');
      const result = run(worktree, parent);
      expect(result.status).toBe(0);
      const body = payloadOf(result.stdout);
      expect(body.mode).not.toBe('BLOCKED');
      expect(body.contract.paths.takeover.counts.incomplete).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
