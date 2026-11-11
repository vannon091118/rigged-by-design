/**
 * @test-target: scripts/verify-scope.mjs
 * @error-code: ERR-4019
 *
 * `verify:scope` liest ausschliesslich den Diff und vergleicht ihn mit der
 * Claim-Allowlist. Der Test belegt die reine Entscheidung und den echten
 * CLI-Pfad: ein fremder Pfad wird rot, ein diff-konformer Lauf bleibt gruen.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessScope } from '../../../../scripts/verify-scope.mjs';

interface ScopePayload {
  readonly status: string;
  readonly allowed: readonly string[];
  readonly foreign: readonly string[];
}

const SCRIPT = resolve(process.cwd(), 'scripts', 'verify-scope.mjs');

const git = (cwd: string, args: readonly string[]): void => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
};

const run = (cwd: string, args: readonly string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd },
  });

const fixture = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-scope-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.name', 'Test Agent']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  writeFileSync(join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  git(dir, ['checkout', '-q', '-b', 'lane/test/scope']);
  mkdirSync(join(dir, '.lane-claims'), { recursive: true });
  writeFileSync(
    join(dir, '.lane-claims', 'claims.json'),
    `${JSON.stringify([{
      id: 'lane/test/scope',
      owner: 'Governance-Owner',
      branch: 'lane/test/scope',
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
  git(dir, ['add', '.lane-claims/claims.json']);
  git(dir, ['commit', '-q', '-m', 'claim']);
  return dir;
};

describe('verify:scope', () => {
  it('trennt erlaubte und fremde Diff-Pfade ohne Git', () => {
    const result = assessScope({
      changed: ['src/allowed.ts', 'src/outside.ts'],
      allowlist: ['src/allowed.ts'],
      branch: 'lane/test/scope',
    });
    expect(result.ok).toBe(false);
    expect(result.allowed).toEqual(['src/allowed.ts']);
    expect(result.foreign).toEqual(['src/outside.ts']);
  });

  it('prueft im Fixture-Repo nur den Diff gegen die Claim-Allowlist', () => {
    const dir = fixture();
    try {
      writeFileSync(join(dir, 'README.md'), '# changed\n');
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'outside.ts'), 'export const outside = true;\n');

      const red = run(dir, ['--json']);
      expect(red.status).toBe(1);
      const redPayload = JSON.parse(red.stdout) as ScopePayload;
      expect(redPayload.status).toBe('ROT');
      expect(redPayload.allowed).toContain('README.md');
      expect(redPayload.foreign).toContain('src/outside.ts');

      rmSync(join(dir, 'src'), { recursive: true, force: true });
      const green = run(dir, ['--json']);
      expect(green.status).toBe(0);
      const greenPayload = JSON.parse(green.stdout) as ScopePayload;
      expect(greenPayload.status).toBe('GRUEN');
      expect(greenPayload.foreign).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
