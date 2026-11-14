/**
 * @test-target: scripts/lib/work-claim.mjs
 * @error-code: ERR-4027
 *
 * Zwei harte Startgates: ohne reservierte Worker-Identitaet startet keine
 * Lane-Arbeit, und ein Issue in `REVIEW_PENDING` sperrt neue Arbeit im selben
 * Worker. Beide melden ERR-4027 und blockieren den Lauf, statt nur zu warnen.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { workState } from '../../../../scripts/lib/work-claim.mjs';
import { workerEnv } from './test-worker-home';

interface Payload {
  readonly state: string;
  readonly blockers: readonly string[];
  readonly contract: {
    readonly workGate: { readonly state: string; readonly blocked: boolean };
    readonly worker: { readonly identityValid: boolean };
  };
}

const it = (name: string, fn: () => void): void => { vitestIt(name, fn, 40_000); };
const WORKER_CODE = 'ERR-4027';

const git = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

function repo(parent: string): string {
  const dir = join(parent, 'repo');
  mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Test Agent']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  writeFileSync(join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  git(dir, ['checkout', '-q', '-b', 'lane/test/gate']);
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(join(dir, '.lane-claims', 'claims.json'), `${JSON.stringify([{
    id: 'lane/test/gate',
    owner: 'Governance-Owner',
    branch: 'lane/test/gate',
    baseSha: '0'.repeat(40),
    issue: 605,
    task: 'Gate-Fixture',
    pathAllowlist: ['README.md'],
    contracts: [],
    dependencies: [],
    gateProfile: 'light',
    status: 'open',
    createdAt: '0'.repeat(40),
  }], null, 2)}\n`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'scripts', 'agent-context.mjs'),
    "console.log(JSON.stringify({ systems: [], tests: { runAll: false, selected: [], fast: [], long: [] }, gates: [] }));\n",
  );
  git(dir, ['add', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(dir, ['commit', '-q', '-m', 'claim']);
  return dir;
}

function ghStub(parent: string): string {
  const bin = join(parent, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'gh.mjs');
  writeFileSync(script, `const args = process.argv.slice(2);
if (args[0] === 'issue' && args[1] === 'view') {
  console.log(JSON.stringify({ number: 605, state: 'OPEN', labels: [], comments: JSON.parse(process.env.FAKE_COMMENTS || '[]') }));
} else {
  console.log('[]');
}
`);
  return script;
}

function run(cwd: string, parent: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'pretask.mjs'), '--json'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      RBD_ROOT: cwd,
      RBD_GH_BIN: process.execPath,
      RBD_GH_SCRIPT: ghStub(parent),
      ...env,
    },
  });
}

const payloadOf = (stdout: string, stderr = ''): Payload => {
  const text = stdout.slice(stdout.indexOf('{'));
  if (!text.trim()) throw new Error(`pretask ohne JSON: ${stderr}`);
  return JSON.parse(text) as Payload;
};

describe('pretask Worker-Gates', () => {
  it('blockiert ohne Identitaet und meldet ERR-4027', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-gate-identity-'));
    try {
      const cwd = repo(parent);
      const emptyHome = join(parent, 'empty-home');
      mkdirSync(emptyHome, { recursive: true });
      const result = run(cwd, parent, { RBD_WORKSPACE_HOME: emptyHome, FAKE_COMMENTS: '[]' });
      expect(result.status).toBe(1);
      const body = payloadOf(result.stdout, result.stderr);
      expect(body.state).toBe('TASK_BLOCKED');
      expect(body.contract.worker.identityValid).toBe(false);
      expect(body.blockers.join('\n')).toContain(WORKER_CODE);
      expect(body.blockers.join('\n')).toContain('Identitaet');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('blockiert neue Arbeit an einem Issue in REVIEW_PENDING', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-gate-review-'));
    try {
      const cwd = repo(parent);
      const comments = [
        { id: 1, body: 'WORK_CLAIM claim_id=wc-1 identity=LIILITH' },
        { id: 2, body: 'DONE claim_id=wc-1' },
        { id: 3, body: 'REVIEW_PENDING claim_id=wc-1' },
      ];
      expect(workState(comments)).toBe('REVIEW_PENDING');
      const result = run(cwd, parent, { ...workerEnv(), FAKE_COMMENTS: JSON.stringify(comments) });
      expect(result.status).toBe(1);
      const body = payloadOf(result.stdout, result.stderr);
      expect(body.contract.workGate).toEqual({ state: 'REVIEW_PENDING', blocked: true });
      expect(body.blockers.join('\n')).toContain('REVIEW_PENDING');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('laesst ein offenes Issue mit eigener Identitaet weiterlaufen', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-gate-open-'));
    try {
      const cwd = repo(parent);
      const result = run(cwd, parent, { ...workerEnv(), FAKE_COMMENTS: '[]' });
      const body = payloadOf(result.stdout, result.stderr);
      expect(body.contract.worker.identityValid).toBe(true);
      expect(body.contract.workGate).toEqual({ state: 'OPEN', blocked: false });
      expect(body.blockers.filter((entry) => entry.includes(WORKER_CODE))).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
