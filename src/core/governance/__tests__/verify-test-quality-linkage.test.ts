/**
 * @test-target: scripts/verify-test-quality.mjs
 * @error-code: ERR-4019
 *
 * Die Zielverknuepfungserkennung von verify-test-quality erkennt belegte
 * @test-target-Ziele auch ohne statischen Import: Subprozess-Aufrufe,
 * dynamische Importe und Dateisystem-Scans zaehlen als Bezug zum Ziel.
 */
import { describe, expect, it } from 'vitest';
import { collectReferencedFiles } from '../../../../scripts/verify-test-quality.mjs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const TARGETS = {
  cli: resolve(ROOT, 'bin', 'rbd.mjs'),
  contracts: resolve(ROOT, 'scripts', 'verify-contracts.mjs'),
  compact: resolve(ROOT, 'scripts', 'lib', 'compact.mjs'),
  outputBudget: resolve(ROOT, 'scripts', 'verify-output-budget.mjs'),
  pipelinePlan: resolve(ROOT, 'scripts', 'lib', 'pipeline-plan.mjs'),
  worldStore: resolve(ROOT, 'src', 'store', 'world-store.ts'),
};

function testFile(name: string) {
  return resolve(ROOT, 'src', 'core', 'governance', '__tests__', name);
}

describe('Zielverknuepfungserkennung von verify-test-quality', () => {
  it('erkennt statische Importe des Ziels', () => {
    const refs = collectReferencedFiles(testFile('cli-surface.test.ts'));
    expect(refs.references).toContain(TARGETS.cli);
  });

  it('erkennt Ziele aus Subprozess-Aufrufen', () => {
    const refs = collectReferencedFiles(testFile('output-budget-coverage.test.ts'));
    expect(refs.references).toContain(TARGETS.outputBudget);
    const contractsRefs = collectReferencedFiles(testFile('contracts-gate.test.ts'));
    expect(contractsRefs.references).toContain(TARGETS.contracts);
  });

  it('erkennt Ziele aus dynamischen Importen', () => {
    const refs = collectReferencedFiles(testFile('logs-failure-only.test.ts'));
    expect(refs.references).toContain(TARGETS.compact);
    const storeRefs = collectReferencedFiles(resolve(ROOT, 'src', 'store', '__tests__', 'store-command-guard.test.ts'));
    expect(storeRefs.references).toContain(TARGETS.worldStore);
  });

  it('erkennt Ziele im Datei-Scan-Baum', () => {
    const refs = collectReferencedFiles(testFile('workflows-removed.test.ts'));
    expect(refs.references).not.toContain(TARGETS.pipelinePlan);
    expect([...refs.scannedDirs].some((dir) => TARGETS.pipelinePlan.startsWith(`${normalizePath(dir)}/`))).toBe(true);
  });

  it('erkennt keine nicht referenzierten Ziele', () => {
    const refs = collectReferencedFiles(testFile('workflows-removed.test.ts'));
    expect(refs.references).not.toContain(TARGETS.cli);
  });
});

function normalizePath(file: string) {
  return file.replaceAll('\\', '/');
}
