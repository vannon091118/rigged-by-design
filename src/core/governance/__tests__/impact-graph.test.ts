/**
 * @test-target: scripts/lib/impact-graph.mjs
 * @error-code: ERR-4019
 *
 * Der Impact-Pfad muss ohne `node_modules` laufen. Der Test belegt beide
 * Richtungen: ein direkter oder transitiver Compiler-Import wird rot, der
 * echte Pfad bleibt gruen. Die Fixtures ersetzen nur die Kantenleser, nicht
 * die Traversierung.
 */
import { describe, expect, it } from 'vitest';
import { auditImpactGraph } from '../../../../scripts/lib/impact-graph.mjs';

const fixture = (files: Readonly<Record<string, readonly string[]>>) => ({
  root: '/',
  entries: ['entry.mjs'],
  specifiersOf: (file: string) => files[file.replace(/^\//, '')] ?? [],
  resolveSpecifier: (specifier: string) => (specifier.startsWith('.') ? `/${specifier.replace(/^\.\//, '')}` : null),
});

describe('Impact-Graph-Gate', () => {
  it('weist einen direkten Compiler-Import im Impact-Pfad ab', () => {
    const result = auditImpactGraph(fixture({ 'entry.mjs': ['typescript'] }));
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { file: 'entry.mjs', specifier: 'typescript', reason: 'TypeScript-Compiler' },
    ]);
  });

  it('findet den Compiler auch transitiv ueber ts-ast', () => {
    const result = auditImpactGraph(fixture({
      'entry.mjs': ['./helper.mjs'],
      'helper.mjs': ['./ts-ast.mjs'],
    }));
    expect(result.ok).toBe(false);
    expect(result.modules).toContain('helper.mjs');
    expect(result.violations.map((entry) => entry.specifier)).toContain('./ts-ast.mjs');
  });

  it('akzeptiert den echten Impact-Pfad ohne node_modules', () => {
    const result = auditImpactGraph();
    expect(result.ok).toBe(true);
    expect(result.modules).toContain('scripts/lib/impact.mjs');
    expect(result.modules).toContain('scripts/lib/imports.mjs');
  });
});
