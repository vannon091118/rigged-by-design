/** @test-target: scripts/verify-narrative-blocks.mjs | @error-code: ERR-4022 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts', 'verify-narrative-blocks.mjs');

function run(args: readonly string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

describe('verify-narrative-blocks CLI', () => {
  it('zeigt mit --help die Nutzung, ohne den Prueflauf zu starten', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Nutzung: node scripts/verify-narrative-blocks.mjs');
    expect(result.stdout).toContain('--commit');
    expect(result.stdout).not.toContain('gewertete Bausteine');
  });

  it('lehnt eine unbekannte Option mit Exit 2 und Nutzung ab', () => {
    const result = run(['--helpp']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unbekannte Option: --helpp');
    expect(result.stderr).toContain('Nutzung: node scripts/verify-narrative-blocks.mjs');
    expect(result.stdout).not.toContain('gewertete Bausteine');
  });

  it('fuehrt den Prueflauf ohne Optionen weiterhin aus', () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('gewertete Bausteine');
    expect(result.stdout).toContain('[narrative-blocks] PASS');
  });
});
