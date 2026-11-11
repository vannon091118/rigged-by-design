/**
 * @test-target: scripts/agent-cause.mjs
 * @error-code: ERR-4019
 *
 * agent:cause muss aus einem Gate-Log ohne Filter den Gate-Namen, den Fix,
 * die Repro-Datei und den Exit-Code ableiten. Ein Lauf ohne roten Befund
 * bleibt GRUEN. Die Fixtures sind echte Log-Zeilen und echte Git-Repos; der
 * CLI-Lauf ist derselbe Pfad wie in der CI.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { causeBlock, causeForGate, causeLine, diagnoseLog } from '../../../../scripts/agent-cause.mjs';

interface CauseFinding {
  readonly gate: string | null;
  readonly code: string;
  readonly fix: string;
  readonly repro: string;
  readonly reproFile: string | null;
}

interface CausePayload {
  readonly status: string;
  readonly findings: readonly CauseFinding[];
  readonly blockers?: readonly string[];
  readonly error?: string;
}

const SCRIPT = resolve(process.cwd(), 'scripts', 'agent-cause.mjs');

const run = (args: readonly string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: process.cwd(), encoding: 'utf8' });

const runIn = (cwd: string, args: readonly string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, RBD_ROOT: cwd },
  });

const git = (cwd: string, args: readonly string[]): void => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
};

const payload = (stdout: string): CausePayload => JSON.parse(stdout) as CausePayload;

const withLog = (text: string, fn: (file: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), 'rbd-cause-'));
  try {
    const file = join(dir, 'gate.log');
    writeFileSync(file, text);
    fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('agent:cause', () => {
  it('liest Gate, Fix und Repro-Datei aus einem Lint-Log', () => {
    const log = '[IDX-0002] [ERR-4011] pipeline/lint: Gate fehlgeschlagen\n  src/ui/stage-controls.tsx\n';

    // Derselbe Auswerter wie die CLI, ohne Prozessstart.
    const direct = diagnoseLog(log);
    expect(direct[0]?.gate).toBe('lint');
    expect(direct[0]?.fix).toBe('pnpm run lint:fix');
    expect(direct[0]?.reproFile).toBe('src/ui/stage-controls.tsx');
    expect(direct[0]?.repro).toBe('node scripts/run-pipeline.mjs --profile=full --gate=lint');

    withLog(log, (file) => {
      const result = run(['--from-file', file, '--json']);
      expect(result.status).toBe(1);
      const body = payload(result.stdout);
      expect(body.status).toBe('ROT');
      expect(body.findings[0]?.gate).toBe('lint');
      expect(body.findings[0]?.reproFile).toBe('src/ui/stage-controls.tsx');
    });
  });

  it('liefert mit --line Pfad, Gate, Code, Fix und Repro in einer Zeile', () => {
    const log = '[IDX-0002] [ERR-4011] pipeline/lint: Gate fehlgeschlagen\n  src/ui/stage-controls.tsx\n';
    const [finding] = diagnoseLog(log);
    if (!finding) throw new Error('Lint-Log ergab keinen Befund');
    expect(causeLine(finding)).toBe(
      'src/ui/stage-controls.tsx | lint | ERR-4011 | pnpm run lint:fix | node scripts/run-pipeline.mjs --profile=full --gate=lint',
    );
    withLog(log, (file) => {
      const result = run(['--from-file', file, '--line']);
      expect(result.status).toBe(1);
      expect(result.stdout.trim()).toBe(`ROT · ${causeLine(finding)}`);
    });
  });

  it('waehlt fuer einen roten Test die Testdatei und das Vitest-Kommando', () => {
    withLog('[IDX-0002] [ERR-4026] pipeline/tests: Gate fehlgeschlagen\n  src/core/sim/__tests__/soak.test.ts\n', (file) => {
      const result = run(['--from-file', file, '--json']);
      expect(result.status).toBe(1);
      const finding = payload(result.stdout).findings[0];
      expect(finding?.gate).toBe('tests');
      expect(finding?.fix).toBe('pnpm run test:affected');
      expect(finding?.reproFile).toBe('src/core/sim/__tests__/soak.test.ts');
      expect(finding?.repro).toContain('pnpm exec vitest run --config src/Config/vite.config.ts');
    });
  });

  it('loest Gate-Namen mit Doppelpunkt auf (check:loc)', () => {
    withLog('[IDX-0001] [ERR-4012] pipeline/check:loc: Gate fehlgeschlagen\n  src/core/sim/simulation.ts\n', (file) => {
      const result = run(['--from-file', file, '--json']);
      expect(result.status).toBe(1);
      const finding = payload(result.stdout).findings[0];
      expect(finding?.gate).toBe('check:loc');
      expect(finding?.fix).toContain('Datei splitten');
      expect(finding?.reproFile).toBe('src/core/sim/simulation.ts');
      expect(finding?.repro).toBe('node scripts/run-pipeline.mjs --profile=full --gate=check:loc');
    });
  });

  it('liefert fuer ein rotes Gate ohne Log Gate, Fix und Repro-Befehl', () => {
    const finding = causeForGate('lint');
    expect(finding.gate).toBe('lint');
    expect(finding.fix).toBe('pnpm run lint:fix');
    expect(finding.repro).toBe('node scripts/run-pipeline.mjs --profile=full --gate=lint');

    const block = causeBlock([finding]);
    expect(block).toContain('Pfad      (kein Pfad)');
    expect(block).toContain('Gate      lint');
    expect(block).toContain('Code      ERR-4011');
    expect(block).toContain('Fix       pnpm run lint:fix');
    expect(block).toContain('Repro     node scripts/run-pipeline.mjs --profile=full --gate=lint');
  });

  it('nutzt fuer rote betroffene Tests den direkten Repro-Befehl', () => {
    const finding = causeForGate('affected');
    expect(finding.gate).toBe('affected');
    expect(finding.fix).toBe('pnpm run test:affected');
    expect(finding.repro).toBe('pnpm run test:affected');
  });

  it('bleibt im isolierten Fixture-Repo ohne rote Gates gruen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-cause-green-'));
    try {
      git(dir, ['init', '-q']);
      git(dir, ['config', 'user.name', 'Test Agent']);
      git(dir, ['config', 'user.email', 'test@example.invalid']);
      writeFileSync(join(dir, 'README.md'), '# fixture\n');
      git(dir, ['add', 'README.md']);
      git(dir, ['commit', '-q', '-m', 'fixture']);

      const result = runIn(dir, ['--offline', '--json']);
      expect(result.status).toBe(0);
      const body = payload(result.stdout);
      expect(body.status).toBe('GRUEN');
      expect(body.findings).toEqual([]);
      expect(body.blockers).toEqual([]);
      expect(body.error).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('meldet ein fehlendes Log mit Exit 1 statt mit einem Befund', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-cause-missing-'));
    try {
      const result = run(['--from-file', join(dir, 'fehlt.log'), '--json']);
      expect(result.status).toBe(1);
      const body = payload(result.stdout);
      expect(body.findings).toEqual([]);
      expect(body.error).toContain('Log nicht lesbar');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
