/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Fail-Closed des Issue-Checks: `governance/blocked` ist ein eigener Blocker,
 * und ein nicht abfragbarer Zustand ist UNKNOWN statt "keine Blocker".
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
  readonly mergeBlocked: string | null;
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

const run = (cwd: string, env: NodeJS.ProcessEnv) =>
  spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), '--json'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...workerEnv(), RBD_ROOT: cwd, ...env },
  });

const payload = (stdout: string): Payload => JSON.parse(stdout) as Payload;

/** Ein Fake, der nur auf genau ein Label antwortet; andere Labels sind leer. */
const fakeGh = (parent: string, match: string, issue: { number: number; title: string; labels: readonly string[] }): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, `gh-${match.replace(/\W+/g, '-')}.mjs`);
  const payloadJson = JSON.stringify([{
    number: issue.number,
    title: issue.title,
    url: `https://example.invalid/${issue.number}`,
    body: '',
    labels: issue.labels.map((name) => ({ name })),
  }]);
  writeFileSync(script, `const args = process.argv.slice(2);\nconsole.log(args.includes(${JSON.stringify(match)}) ? ${JSON.stringify(payloadJson)} : '[]');\n`);
  return script;
};

/** Ein lesbarer, leerer Issue-Zustand: keine Blocker, aber nachweislich gelesen. */
const emptyGh = (parent: string): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh-empty.mjs');
  writeFileSync(script, "console.log('[]');\n");
  return script;
};

/** Ein Abruf, der immer scheitert: der Issue-Zustand bleibt unbekannt. */
const brokenGh = (parent: string): string => {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh-broken.mjs');
  writeFileSync(script, 'process.exit(1);\n');
  return script;
};

describe('pretask fail-closed issue check', () => {
  it('blockt ein governance/blocked-Issue ohne Scope-Label', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-blocked-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/blocked');
      const script = fakeGh(parent, 'governance/blocked', {
        number: 41,
        title: 'BLOCKED: Governance-Freeze verletzt',
        labels: ['governance/blocked'],
      });
      const result = run(worktree, { RBD_GH_BIN: process.execPath, RBD_GH_SCRIPT: script });
      expect(result.status).toBe(1);
      const blockers = payload(result.stdout).blockers.join('\n');
      expect(blockers).toContain('Governance-BLOCKED #41');
      expect(blockers).toContain(ISOLATION_CODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('laesst einen sauberen Start mit gelesener, leerer Issue-Liste durch', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-clean-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/clean');
      const result = run(worktree, { RBD_GH_BIN: process.execPath, RBD_GH_SCRIPT: emptyGh(parent) });
      expect(result.status).toBe(0);
      expect(payload(result.stdout).blockers).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('laesst lokale Arbeit bei UNKNOWN zu und sperrt nur den Merge', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-unknown-'));
    try {
      const worktree = linkedRepo(parent, 'repo', 'lane/test/unknown');
      const result = run(worktree, { RBD_GH_BIN: process.execPath, RBD_GH_SCRIPT: brokenGh(parent) });
      expect(result.status).toBe(0);
      const data = payload(result.stdout);
      expect(data.blockers.join('\n')).not.toContain('Issue-Check UNKNOWN');
      expect(data.blockers.join('\n')).not.toContain(ISOLATION_CODE);
      expect(data.warnings.join('\n')).toContain('Issue-Check UNKNOWN');
      expect(data.mergeBlocked).toContain('Merge');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
