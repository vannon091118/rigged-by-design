/**
 * @test-target: scripts/lib/gate-diagnostics.mjs
 * @error-code: ERR-4026
 *
 * Ein roter Lauf kann mehrere unabhaengige Fehler enthalten. Diese Grenzen
 * stehen hier: alle roten Jobs, ein Eintrag je rotem Schritt, PASS-Zeilen
 * zaehlen nicht als Befund, gleiche Codes werden gruppiert, und der Bericht
 * nennt jedes betroffene Gate.
 */
import { describe, expect, it } from 'vitest';
import { diagnose, errorFromLog, groupFailures } from '../../../../scripts/lib/gate-diagnostics.mjs';

interface Failure {
  readonly gate: string;
  readonly step: string | null;
  readonly code: string;
  readonly line: string;
  readonly level: string;
  readonly failedTest: string | null;
  readonly url: string | null;
}

interface Group {
  readonly code: string;
  readonly gates: string[];
}

interface Diagnosis {
  readonly failures: Failure[];
  readonly groups: Group[];
  readonly report: string;
  readonly codes: string[];
}

const job = (id: number, name: string, conclusion: string, steps: { name: string; conclusion: string }[] = []) =>
  ({ id, name, conclusion, steps });
const failed = (name: string) => ({ name, conclusion: 'failure' });
const passed = (name: string) => ({ name, conclusion: 'success' });

describe('gate-diagnostics', () => {
  it('meldet alle fehlgeschlagenen Gates eines Laufs, nicht nur das erste', () => {
    const jobs = [
      job(1, 'Gate lint', 'failure', [failed('Lint')]),
      job(2, 'Gate docs', 'failure', [failed('Doku-Gate')]),
      job(3, 'Gate typecheck', 'success', [passed('Typecheck')]),
    ];
    const result: Diagnosis = diagnose({ jobs });
    expect({ gates: result.failures.map((failure: Failure) => failure.gate), codes: result.codes }).toEqual({
      gates: ['Gate lint', 'Gate docs'],
      codes: ['ERR-0000'],
    });
  });

  it('legt je fehlgeschlagenem Schritt einen Befund an', () => {
    const jobs = [job(7, 'Gate dead-code', 'failure', [passed('Setup'), failed('Dead-Export'), failed('Bericht')])];
    const result: Diagnosis = diagnose({ jobs });
    expect(result.failures.map((failure: Failure) => failure.step)).toEqual(['Dead-Export', 'Bericht']);
  });

  it('nimmt keine PASS-Zeile als Fehlercode', () => {
    const log = '[IDX-0001] [ERR-4011] lint > regel: PASS\n[IDX-0002] [ERR-4012] Gate fehlgeschlagen: zu gross';
    expect(errorFromLog(log)).toEqual({ code: 'ERR-4012', line: '[IDX-0002] [ERR-4012] Gate fehlgeschlagen: zu gross', failedTest: null });
  });

  it('gruppiert mehrere Gates mit demselben Code als eine Ursache', () => {
    const groups: Group[] = groupFailures([
      { gate: 'Gate tree', step: null, code: 'ERR-4019', line: 'a', level: 'AGENT', failedTest: null, url: null },
      { gate: 'Gate docs', step: null, code: 'ERR-4019', line: 'a', level: 'AGENT', failedTest: null, url: null },
      { gate: 'Gate lint', step: null, code: 'ERR-4011', line: 'b', level: 'AGENT', failedTest: null, url: null },
    ]);
    expect(groups.map((group: Group) => ({ code: group.code, gates: group.gates }))).toEqual([
      { code: 'ERR-4019', gates: ['Gate tree', 'Gate docs'] },
      { code: 'ERR-4011', gates: ['Gate lint'] },
    ]);
  });

  it('nennt im Bericht jedes rote Gate', () => {
    const jobs = [job(1, 'Gate lint', 'failure', [failed('Lint')]), job(2, 'Gate docs', 'failure', [failed('Doku-Gate')])];
    const result: Diagnosis = diagnose({ jobs });
    expect({ lint: result.report.includes('Gate lint'), docs: result.report.includes('Gate docs') })
      .toEqual({ lint: true, docs: true });
  });
});
