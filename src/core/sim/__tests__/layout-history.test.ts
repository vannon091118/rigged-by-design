/**
 * @test-target: src/core/sim/layout-history.ts
 * @error-code: ERR-2002
 *
 * Verlauf: 30 Schritte, ein Pinselstrich ist ein Schritt, Redo endet bei neuer Arbeit.
 */
import { describe, expect, it } from 'vitest';
import { LayoutHistory } from '../layout-history';
import { layoutFromTemplate } from '../layout-derive';
import type { LayoutState } from '../layout-types';

const layout = layoutFromTemplate('SMALL');
const other: LayoutState = { ...layout, floor: layout.floor.map(() => 'WOOD') };
const third: LayoutState = { ...layout, floor: layout.floor.map(() => 'TILE') };

describe('Layout-Verlauf', () => {
  it('behaelt hoechstens 30 Schritte und vergisst den aeltesten', () => {
    const history = new LayoutHistory(30);
    for (let step = 0; step < 31; step += 1) {
      const before: LayoutState = { ...layout, edges: layout.edges.slice(0, step) };
      const after: LayoutState = { ...layout, edges: layout.edges.slice(0, step + 1) };
      history.push({ label: `Schritt ${step}`, before, after });
    }
    expect(history.depth).toBe(30);
    let undone = 0;
    while (history.undo()) undone += 1;
    expect(undone).toBe(30);
    expect(history.canUndo).toBe(false);
  });

  it('macht einen Schritt rueckgaengig und stellt ihn wieder her', () => {
    const history = new LayoutHistory();
    history.push({ label: 'Boden', before: layout, after: other });
    const undone = history.undo();
    expect(undone?.before).toBe(layout);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    const redone = history.redo();
    expect(redone?.after).toBe(other);
    expect(history.canRedo).toBe(false);
    expect(history.depth).toBe(1);
  });

  it('verwirft Redo, sobald neue Arbeit beginnt', () => {
    const history = new LayoutHistory();
    history.push({ label: 'Boden', before: layout, after: other });
    history.undo();
    expect(history.canRedo).toBe(true);
    history.push({ label: 'Neu', before: layout, after: third });
    expect(history.canRedo).toBe(false);
  });

  it('zaehlt einen Pinselstrich als einen Schritt, auch mit vielen Edits', () => {
    const history = new LayoutHistory();
    history.push({ label: 'Pinselstrich', before: layout, after: third });
    expect(history.depth).toBe(1);
    expect(history.undo()?.before).toBe(layout);
  });

  it('ignoriert Schritte ohne Layoutaenderung', () => {
    const history = new LayoutHistory();
    history.push({ label: 'Nichts', before: layout, after: layout });
    expect(history.depth).toBe(0);
    expect(history.canUndo).toBe(false);
  });
});
