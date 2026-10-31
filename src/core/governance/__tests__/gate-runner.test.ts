/**
 * @test-target: scripts/lib/gate-runner.mjs
 * @error-code: ERR-4014
 *
 * Ein haengendes Gate darf den Lauf nicht offen halten: Nach dem harten Limit
 * wird der Prozessbaum beendet und der Lauf meldet 124 statt weiterzuwarten.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeStep, runGates } from '../../../../scripts/lib/gate-runner.mjs';
import { releaseOwner } from '../../../../scripts/lib/process-sweep.mjs';

const stateDir = mkdtempSync(join(tmpdir(), 'rbd-gate-timeout-'));
const reportsDir = join(stateDir, 'reports');
let holdPath = '';
let quickPath = '';
let failPath = '';

beforeAll(() => {
  process.env.RBD_VERIFY_STATE = stateDir;
  // Der Berichtsordner muss vor dem ersten runGates feststehen: er wird gemerkt.
  process.env.RBD_VERIFY_REPORTS = reportsDir;
  holdPath = join(stateDir, 'hold.mjs');
  quickPath = join(stateDir, 'quick.mjs');
  failPath = join(stateDir, 'fail.mjs');
  writeFileSync(holdPath, 'setTimeout(() => {}, 5000);\n');
  writeFileSync(quickPath, 'process.exit(0);\n');
  writeFileSync(failPath, "console.error('boom'); process.exit(3);\n");
});

afterAll(() => {
  releaseOwner();
  rmSync(stateDir, { recursive: true, force: true });
  delete process.env.RBD_VERIFY_STATE;
  delete process.env.RBD_VERIFY_REPORTS;
});

describe('Harte Gate-Timeouts', () => {
  it('beendet ein Gate nach dem Limit und meldet 124', async () => {
    const result = await executeStep({
      name: 'timeout-probe',
      command: 'node',
      script: holdPath,
      timeoutMs: 150,
    });
    expect(result.timedOut).toBe(true);
    expect(result.status).toBe(124);
    expect(result.timeoutMs).toBe(150);
  });

  it('laesst ein Gate vor dem Limit normal enden', async () => {
    const result = await executeStep({
      name: 'quick-probe',
      command: 'node',
      script: quickPath,
      timeoutMs: 10_000,
    });
    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(0);
  });

  it('meldet ein Timeout in der Gate-Auswertung als rotes Gate', async () => {
    const failed = await runGates([{
      name: 'timeout-probe',
      command: 'node',
      script: holdPath,
      timeoutMs: 100,
    }]);
    expect(failed).toContain('timeout-probe');
  });

  it('legt vollstaendige Logs und eine Zusammenfassung als Artefakt ab', async () => {
    const failed = await runGates([{ name: 'artifact-probe', command: 'node', script: failPath, timeoutMs: 10_000 }]);
    expect(failed).toContain('artifact-probe');

    const log = readFileSync(join(reportsDir, 'artifact-probe.log'), 'utf8');
    expect(log).toContain('FAIL');
    expect(log).toContain('boom');

    const summary = readFileSync(join(reportsDir, 'summary.md'), 'utf8');
    expect(summary).toContain('artifact-probe');
    expect(summary).toContain('FAIL (artifact-probe)');
  });
});
