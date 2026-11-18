/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Waechter fuer #998: Sim-Tests belegen ihren Verlauf mit strukturierter
 * Ausgabe. Ein `console.log` in einer Testdatei unter `src/core/sim/__tests__/`
 * ist wieder freie Ausgabe und sprengt das Ausgabe-Budget; dieser Test haelt
 * die Regel und den Vertrag von `testEvent`/`writeTestReport` fest.
 */
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { testEvent, writeTestReport } from './test-log';

const ROOT = resolve(process.cwd());
const SIM_TESTS = join(ROOT, 'src', 'core', 'sim', '__tests__');
const CONSOLE_LOG = /console\.log\s*\(/;

describe('Sim-Testausgabe', () => {
  it('haelt Sim-Testdateien frei von console.log', () => {
    const offenders = readdirSync(SIM_TESTS)
      .filter((name) => name.endsWith('.test.ts'))
      .filter((name) => CONSOLE_LOG.test(readFileSync(join(SIM_TESTS, name), 'utf8')));
    expect(offenders, 'freie Ausgabe gehoert in testEvent oder writeTestReport').toEqual([]);
  });

  it('schreibt ein Ereignis als genau eine JSON-Zeile', () => {
    const writes: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      testEvent('probe', 'start', { seed: 7 });
    } finally {
      process.stdout.write = original;
    }
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0] as string)).toEqual({ scope: 'probe', event: 'start', seed: 7 });
  });

  it('legt einen mehrzeiligen Bericht unter .verify-cache/output ab', () => {
    const path = writeTestReport('probe-report-998', ['zeile 1', 'zeile 2']);
    expect(path).toBe(join(ROOT, '.verify-cache', 'output', 'probe-report-998.log'));
    expect(readFileSync(path, 'utf8')).toBe('zeile 1\nzeile 2\n');
    rmSync(path, { force: true });
  });
});
