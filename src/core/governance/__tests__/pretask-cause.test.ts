/**
 * @test-target: scripts/agent-cause.mjs
 * @error-code: ERR-4019
 *
 * `pretask` und `turn:finish` geben einen roten Gate-Befund automatisch als
 * Gate/Fix/Repro aus. Die Fixtures starten den echten pretask-Pfad; die
 * Zuordnung fuer rote betroffene Tests kommt aus demselben agent:cause-Helfer.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { causeBlock, causeForGate } from '../../../../scripts/agent-cause.mjs';
import { workerEnv } from './test-worker-home';

interface Payload {
  readonly causes?: readonly {
    readonly gate: string | null;
    readonly fix: string;
    readonly repro: string;
  }[];
}

const SCRIPT = resolve(process.cwd(), 'scripts', 'pretask.mjs');

const git = (cwd: string, args: readonly string[]): void => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
};

const fixture = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-pretask-cause-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Test Agent']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  writeFileSync(join(dir, 'README.md'), '# fixture\n');
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([{
      id: 'lane/test/cause',
      owner: 'Governance-Owner',
      branch: 'lane/test/cause',
      baseSha: '0'.repeat(40),
      task: 'Fixture',
      pathAllowlist: ['README.md'],
      contracts: [],
      dependencies: [],
      gateProfile: 'light',
      status: 'open',
      createdAt: '0'.repeat(40),
    }], null, 2)}\n`,
  );
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'scripts', 'agent-context.mjs'),
    "console.log(JSON.stringify({ systems: [], tests: { runAll: false, selected: [], fast: [], long: [] }, gates: [] }));\n",
  );
  git(dir, ['add', 'README.md', '.lane-claims/claims.json', 'scripts/agent-context.mjs']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  git(dir, ['checkout', '-q', '-b', 'lane/test/cause']);
  const report = join(dir, '.verify-cache', 'reports', 'agent');
  mkdirSync(report, { recursive: true });
  writeFileSync(join(report, 'agent-summary.json'), `${JSON.stringify({ failed: ['lint'], open: [] })}\n`);
  return dir;
};

const run = (cwd: string, args: readonly string[]) => {
  const gh = join(cwd, 'gh.mjs');
  writeFileSync(gh, '[]\n');
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...workerEnv(), RBD_ROOT: cwd, RBD_GH_BIN: process.execPath, RBD_GH_SCRIPT: gh },
  });
};

const payload = (stdout: string): Payload => JSON.parse(stdout) as Payload;

describe('pretask cause output', () => {
  it('nennt Gate, Fix und Repro aus dem roten Verify-Bericht', () => {
    const dir = fixture();
    try {
      const causes = payload(run(dir, ['--json']).stdout).causes ?? [];
      expect(causes[0]?.gate).toBe('lint');
      expect(causes[0]?.fix).toBe('pnpm run lint:fix');
      expect(causes[0]?.repro).toBe('node scripts/run-pipeline.mjs --profile=full --gate=lint');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('druckt den agent:cause-Block auch in der Klartext-Ausgabe', () => {
    const dir = fixture();
    try {
      const stdout = run(dir, []).stdout;
      expect(stdout).toContain('ROT · agent:cause');
      expect(stdout).toContain('Gate      lint');
      expect(stdout).toContain('Fix       pnpm run lint:fix');
      expect(stdout).toContain('Repro     node scripts/run-pipeline.mjs --profile=full --gate=lint');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('haelt den Repro fuer rote betroffene Tests beim direkten Befehl', () => {
    const finding = causeForGate('affected');
    expect(finding.fix).toBe('pnpm run test:affected');
    expect(finding.repro).toBe('pnpm run test:affected');
    const block = causeBlock([finding]);
    expect(block).toContain('Gate      affected · fail-open-with-issue');
    expect(block).toContain('Code      ERR-4026');
    expect(block).toContain('Repro     pnpm run test:affected');
  });
});
