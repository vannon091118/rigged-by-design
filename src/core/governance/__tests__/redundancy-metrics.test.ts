/**
 * @test-target: scripts/lib/redundancy-metrics.mjs
 * @error-code: ERR-4020
 *
 * Die fuenf Kennzahlen des globalen Scans sind Budgets: Waisenquote, Anteil
 * Module mit Fan-in <= 1, Entry-Points, Aliase und Doku-Bytes. Der Test belegt
 * die Berechnung an einem Fixture-Baum und je Kennzahl die Verletzung.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  measureRedundancy,
  REDUNDANCY_BUDGET,
  redundancyFindings,
} from '../../../../scripts/lib/redundancy-metrics.mjs';

/** Form eines Befunds, abgeleitet aus der Funktion selbst statt doppelt deklariert. */
type RedundancyFinding = ReturnType<typeof redundancyFindings>[number];

const dirs: string[] = [];
const fixture = (files: Readonly<Record<string, string | number>>): string => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-redundancy-'));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, String(content));
  }
  return root;
};

const tree = (): string => fixture({
  'src/main.ts': "import { a } from './a';\nimport { b } from './b';\n",
  'src/a.ts': 'export const a = 1;\n',
  'src/b.ts': 'export const b = 1;\n',
  'src/__tests__/b.test.ts': "import { b } from '../b';\n",
  'scripts/run.mjs': 'console.log(1);\n',
  '.githooks/pre-commit': 'node scripts/run.mjs\n',
  'package.json': JSON.stringify({ scripts: { x: 'node scripts/run.mjs', y: 'node scripts/run.mjs' } }),
  'docs/note.md': '12345',
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('redundancy-metrics', () => {
  it('zaehlt Waisen, Fan-in, Entry-Points, Aliase und Doku-Bytes', () => {
    const metrics = measureRedundancy({ root: tree() });
    expect(metrics.modules).toBe(3);
    // main.ts wird von niemandem importiert; a hat einen, b zwei Importeure.
    expect(metrics.orphans).toBe(1);
    expect(metrics.orphanRate).toBe(33.3);
    expect(metrics.fanInAtMostOne).toBe(2);
    expect(metrics.fanInAtMostOneRate).toBe(66.7);
    expect(metrics.entryPoints).toBe(1);
    expect(metrics.aliases).toBe(1);
    expect(metrics.docFiles).toBe(1);
    expect(metrics.docBytes).toBe(5);
  });

  it('laesst ein Budget auf Ist-Niveau gruen (Ratsche)', () => {
    const metrics = measureRedundancy({ root: tree() });
    expect(redundancyFindings(metrics, {
      orphanRate: metrics.orphanRate,
      fanInAtMostOneRate: metrics.fanInAtMostOneRate,
      entryPoints: metrics.entryPoints,
      aliases: metrics.aliases,
      docBytes: metrics.docBytes,
    })).toEqual([]);
  });

  it('meldet jede Kennzahl einzeln, wenn ihr Limit reisst', () => {
    const metrics = measureRedundancy({ root: tree() });
    const findings = redundancyFindings(metrics, {
      orphanRate: 0,
      fanInAtMostOneRate: 0,
      entryPoints: 0,
      aliases: 0,
      docBytes: 0,
    });
    expect(findings.map((finding: RedundancyFinding) => finding.metric)).toEqual([
      'Waisenquote', 'Anteil Fan-in <= 1', 'Entry-Point-Zahl', 'Alias-Zahl', 'Doku-Bytes',
    ]);
    for (const finding of findings) {
      expect(finding.value.length).toBeGreaterThan(0);
      expect(finding.limit.length).toBeGreaterThan(0);
      expect(finding.hint.length).toBeGreaterThan(8);
    }
  });

  it('bleibt ohne src/ bei null statt zu werfen', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-redundancy-leer-'));
    dirs.push(root);
    const metrics = measureRedundancy({ root });
    expect(metrics.modules).toBe(0);
    expect(metrics.orphanRate).toBe(0);
    expect(metrics.fanInAtMostOneRate).toBe(0);
    expect(redundancyFindings(metrics)).toEqual([]);
  });

  it('prueft die Default-Budgets gegen die gemessene Basis', () => {
    expect(REDUNDANCY_BUDGET.orphanRate).toBeGreaterThanOrEqual(2.5);
    expect(REDUNDANCY_BUDGET.fanInAtMostOneRate).toBeGreaterThanOrEqual(30.7);
    expect(REDUNDANCY_BUDGET.entryPoints).toBeGreaterThanOrEqual(65);
    expect(REDUNDANCY_BUDGET.aliases).toBeGreaterThanOrEqual(1);
    expect(REDUNDANCY_BUDGET.docBytes).toBeGreaterThanOrEqual(1_578_632);
  });
});
