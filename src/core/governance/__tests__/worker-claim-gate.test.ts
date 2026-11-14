/**
 * @test-target: scripts/lib/work-claim.mjs
 * @error-code: ERR-4027
 *
 * Zwei harte Startgates: ohne reservierte Worker-Identitaet und ohne freien
 * Issue-Claim startet keine Lane-Arbeit; beide blockieren statt zu warnen.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { applySnapshot, emptyCursorState, ingestComments, pendingEntries } from '../../../../scripts/lib/board-cursors.mjs';
import { workState } from '../../../../scripts/lib/work-claim.mjs';
import { workerEnv } from './test-worker-home';

type Payload = {
  readonly state: string; readonly blockers: readonly string[];
  readonly contract: {
    readonly workGate: { readonly state: string; readonly blocked: boolean; readonly rejected: number };
    readonly worker: { readonly identityValid: boolean };
  };
};

const it = (name: string, fn: () => void): void => { vitestIt(name, fn, 40_000); };
const WORKER_CODE = 'ERR-4027';
const comment = (id: number, login: string, body: string) => ({ id: String(id), author: { login }, body });
/** Gemeinsamer Fixture-Principal; `pretask` liest die Actor-Policy aus dem Repo. */
const FIXTURE_ACTORS = { maintainers: ['vannon091118'], users: ['vannon091118'], workers: ['vannon091118'] };

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
  writeFileSync(join(dir, '.lane-claims', 'actors.json'), `${JSON.stringify(FIXTURE_ACTORS, null, 2)}\n`);
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
  git(dir, ['add', '.lane-claims/claims.json', '.lane-claims/actors.json', 'scripts/agent-context.mjs']);
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
        comment(1, 'vannon091118', 'WORK_CLAIM claim_id=wc-1 identity=LIILITH'),
        comment(2, 'vannon091118', 'DONE claim_id=wc-1'),
        comment(3, 'vannon091118', 'REVIEW_PENDING claim_id=wc-1'),
      ];
      expect(workState(comments, { actors: FIXTURE_ACTORS })).toBe('REVIEW_PENDING');
      const result = run(cwd, parent, { ...workerEnv(), FAKE_COMMENTS: JSON.stringify(comments) });
      expect(result.status).toBe(1);
      const body = payloadOf(result.stdout, result.stderr);
      expect(body.contract.workGate).toEqual({ state: 'REVIEW_PENDING', blocked: true, rejected: 0 });
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
      expect(body.contract.workGate).toEqual({ state: 'OPEN', blocked: false, rejected: 0 });
      expect(body.blockers.filter((entry) => entry.includes(WORKER_CODE))).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});


/*
 * Board-Cursor (#671): Der Maintainer-State ist nur ein Lesefortschritt.
 * Diese Bloecke belegen die reine Kommentar-Logik, die das Gate speist:
 * genau ein Eingang pro Kommentar, kein Rueckschritt bei Ausfall, getrennte
 * Cursor fuer Issue und PR.
 */
describe('Board-Cursor', () => {
  const comment = (id: number) => ({ id, author: 'maintainer', createdAt: '2026-11-14T00:00:00Z' });
  const scan = (state: object, comments: readonly { id: number }[], complete = true) =>
    ingestComments({ state, kind: 'issues', number: 671, comments, complete });
  const first = scan(emptyCursorState({ head: 'a1' }), [comment(2), comment(1)]);

  it('gibt beim Erstscan jeden Kommentar genau einmal aus', () => {
    expect(first.status).toBe('FIRST_SCAN');
    expect(first.entries.map((entry: { commentId: number }) => entry.commentId)).toEqual([1, 2]);
    expect(first.state.issues['671'].lastCommentId).toBe(2);
  });

  it('erzeugt bei Folgelaeufen weder Verluste noch Duplikate', () => {
    const next = scan(first.state, [comment(2), comment(3)]);
    expect(next.entries.map((entry: { commentId: number }) => entry.commentId)).toEqual([3]);
    expect(scan(next.state, [comment(1), comment(2), comment(3)]).entries).toEqual([]);
  });

  it('laesst den Cursor bei unvollstaendiger Seite stehen (UNKNOWN)', () => {
    const broken = scan(first.state, [comment(9)], false);
    expect(broken.status).toBe('UNKNOWN');
    expect(broken.entries).toEqual([]);
    expect(broken.state.issues['671'].lastCommentId).toBe(2);
    expect(broken.state.warnings.join(' ')).toContain('UNKNOWN');
  });

  it('trennt Issue und PR mit gleicher Nummer', () => {
    const pr = ingestComments({ state: first.state, kind: 'pullRequests', number: 671, comments: [comment(2)] });
    expect(pr.entries.map((entry: { kind: string }) => entry.kind)).toEqual(['pullRequests']);
    expect(pr.state.issues['671'].lastCommentId).toBe(2);
  });

  it('uebernimmt nur Kopfdaten und liefert Eingaenge als sortierte P0-Liste', () => {
    const snapshot = applySnapshot(first.state, { head: 'b2', openPullRequests: 3 });
    expect(snapshot.head).toBe('b2');
    expect(snapshot.issues['671'].lastCommentId).toBe(2);
    const labels = pendingEntries([
      { kind: 'issues', number: 671, commentId: 3 },
      { kind: 'pullRequests', number: 12, commentId: 1 },
    ]).map((entry: { label: string }) => entry.label);
    expect(labels).toEqual(['P0 PR #12 (Kommentar 1)', 'P0 Issue #671 (Kommentar 3)']);
  });
});
