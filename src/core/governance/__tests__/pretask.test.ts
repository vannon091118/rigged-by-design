/**
 * @test-target: scripts/lib/worktree-isolation.mjs
 * @error-code: ERR-4019
 *
 * Der echte `pretask`-Start in temporaeren Git-Repos. Die Isolation-Hilfe
 * liefert den Fehlercode; die Fixtures pruefen die Startblocker.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it as vitestIt } from 'vitest';
import { ISOLATION_CODE } from '../../../../scripts/lib/worktree-isolation.mjs';
import { cleanRepo, fixture, git, payloadOf, runPretask, writeClaim, writeFakeGh } from './test-worker-home';

// Git-Worktrees brauchen auf Windows gelegentlich laenger als das Default-Limit.
const it = (name: string, fn: () => void): void => { vitestIt(name, fn, 40_000); };

describe('pretask start blockers', () => {
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

  it('berechnet den Impact im eigenen Prozess statt in einem zweiten Node-Start', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-context-'));
    try {
      const repo = fixture(parent, 'repo');
      git(repo, ['checkout', '-q', '-b', 'lane/test/context']);
      writeClaim(repo, 'lane/test/context', ['README.md']);
      git(repo, ['add', '.lane-claims/claims.json', '.lane-claims/actors.json']);
      git(repo, ['commit', '-q', '-m', 'claim without external context']);
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status, payloadOf(result.stdout).blockers.join('\n')).toBe(0);
      expect(payloadOf(result.stdout).context).toBe('.verify-cache/agent-context.json');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('laesst eine saubere Lane im geteilten Arbeitsbaum zu', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-shared-lane-'));
    try {
      const repo = cleanRepo(parent, 'repo', 'lane/test/shared');
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status, payloadOf(result.stdout).blockers.join('\n')).toBe(0);
      const payload = payloadOf(result.stdout);
      expect(payload.isolation.required).toBe(false);
      expect(payload.isolation.code).toBe(ISOLATION_CODE);
      expect(payload.isolation.isWorktree).toBe(false);
      expect(payload.isolation.reasons).toEqual([]);
      expect(payload.blockers).toEqual([]);
      expect(payload.context).toBe('.verify-cache/agent-context.json');
      expect(JSON.parse(readFileSync(join(repo, '.verify-cache', 'agent-context.json'), 'utf8')).systems).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('liefert im JSON nur den Kontextpfad statt eines eingebetteten Impact-Blocks', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-pretask-context-path-'));
    try {
      const repo = cleanRepo(parent, 'repo', 'lane/test/context-path');
      const fake = writeFakeGh(parent);
      const result = runPretask(repo, ['--json'], {
        RBD_GH_BIN: process.execPath,
        RBD_GH_SCRIPT: fake.script,
      });
      expect(result.status, payloadOf(result.stdout).blockers.join('\n')).toBe(0);
      const payload = payloadOf(result.stdout);
      expect(payload.context).toBe('.verify-cache/agent-context.json');
      expect(payload).not.toHaveProperty('impact');
      expect(payload).not.toHaveProperty('impactPlan');
      const context = JSON.parse(readFileSync(join(repo, '.verify-cache', 'agent-context.json'), 'utf8'));
      expect(Array.isArray(context.systems)).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
