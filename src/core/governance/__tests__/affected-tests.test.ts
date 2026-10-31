/**
 * @test-target: scripts/lib/affected-tests.mjs
 * @error-code: ERR-4008
 *
 * Die Auswahl muss deklarierte Ziele, direkte Importe und das betroffene
 * Subsystem treffen; Konfigurationsaenderungen fallen auf alle Tests zurueck,
 * reine Doku laesst die Auswahl leer.
 */
import { describe, expect, it } from 'vitest';
import { listTests, selectAffectedTests } from '../../../../scripts/lib/affected-tests.mjs';

describe('Betroffene Tests', () => {
  it('waehlt Ziel und Importeure einer Spielaenderung', () => {
    const result = selectAffectedTests(['src/core/games/poker-hand.ts']);
    expect(result.tests).toContain('src/core/games/__tests__/poker-distribution.test.ts');
    expect(result.tests).toContain('src/core/games/__tests__/poker-table.test.ts');
    expect(result.runAll).toBe(false);
  });

  it('waehlt den Workflow-Test bei einer Workflow-Aenderung', () => {
    const result = selectAffectedTests(['.github/workflows/ci-verify.yml']);
    expect(result.tests).toContain('src/core/governance/__tests__/ci-gates.test.ts');
    expect(result.runAll).toBe(false);
  });

  it('waehlt den Prozess-Sweep-Test bei einer Skriptaenderung', () => {
    const result = selectAffectedTests(['scripts/lib/process-sweep.mjs']);
    expect(result.tests).toContain('src/core/governance/__tests__/process-sweep.test.ts');
    expect(result.runAll).toBe(false);
  });

  it('faellt bei einer Konfigurationsaenderung auf alle Tests zurueck', () => {
    const all = listTests();
    const result = selectAffectedTests(['package.json']);
    expect(result.runAll).toBe(true);
    expect(result.tests).toEqual(all);
  });

  it('laesst reine Doku ohne Testauswahl', () => {
    const result = selectAffectedTests(['docs/ARCHITECTURE.md']);
    expect(result.tests).toEqual([]);
    expect(result.runAll).toBe(false);
  });
});
