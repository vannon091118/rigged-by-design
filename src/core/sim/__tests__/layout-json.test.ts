/**
 * @test-target: src/core/sim/layout-json.ts
 * @error-code: ERR-2002
 *
 * Layout-Export/-Import: runde Reise, feste Bytes, fail-closed bei fremden Daten.
 */
import { describe, expect, it } from 'vitest';
import { exportLayout, importLayout, LAYOUT_JSON_VERSION } from '../layout-json';
import { layoutFromTemplate } from '../layout-derive';

const layout = layoutFromTemplate('SMALL');

describe('Layout-JSON', () => {
  it('exportiert und importiert dasselbe Layout', () => {
    const result = importLayout(exportLayout(layout));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layout).toEqual(layout);
  });

  it('schreibt deterministische Bytes ohne Laufzeitfelder', () => {
    const first = exportLayout(layout);
    expect(exportLayout(layout)).toBe(first);
    const document = JSON.parse(first) as Record<string, unknown>;
    expect(document.version).toBe(LAYOUT_JSON_VERSION);
    expect(Object.keys(document).sort()).toEqual(['format', 'layout', 'version']);
    expect(Object.keys(document.layout as object).sort()).toEqual(['edges', 'floor', 'size', 'zones']);
  });

  it('lehnt fremde Formate und Versionen ab', () => {
    const valid = JSON.parse(exportLayout(layout)) as Record<string, unknown>;
    expect(importLayout(JSON.stringify({ ...valid, format: 'andere-app' })).ok).toBe(false);
    expect(importLayout(JSON.stringify({ ...valid, version: LAYOUT_JSON_VERSION + 1 })).ok).toBe(false);
    expect(importLayout(JSON.stringify({ ...valid, extra: true })).ok).toBe(false);
    expect(importLayout(JSON.stringify({ ...valid, layout: null })).ok).toBe(false);
  });

  it('lehnt kaputtes JSON ohne Wurf ab', () => {
    const result = importLayout('{');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reicht Layoutfehler als Befunde durch', () => {
    const broken = JSON.parse(exportLayout(layout)) as { layout: Record<string, unknown> };
    broken.layout.floor = ['MARMOR'];
    const result = importLayout(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(' ')).toContain('Boden');
  });
});
