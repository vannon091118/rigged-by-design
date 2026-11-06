/**
 * @test-target: src/core/sim/layout-commands.ts
 * @error-code: ERR-2002
 *
 * Typisierte Layout-Commands: nur die genannten Tiles/Kanten aendern sich,
 * ungueltige Zustaende werden fail-closed abgelehnt.
 */
import { describe, expect, it } from 'vitest';
import { layoutFromTemplate } from '../layout-derive';
import { edgeKey } from '../layout-edges';
import { applyLayoutCommand } from '../layout-commands';
import { LayoutContractError } from '../layout';
import { exportLayout } from '../layout-json';
import type { EdgeCell, TileRect } from '../layout-commands';
import type { LayoutState } from '../layout-types';

const small = layoutFromTemplate('SMALL');
const rect: TileRect = { x: 2, y: 2, w: 3, h: 2 };

function freeEdge(layout: LayoutState): EdgeCell {
  const taken = new Set(layout.edges.map((edge) => edgeKey(edge.axis, edge.x, edge.y)));
  for (let y = 1; y < layout.size; y += 1) {
    for (let x = 0; x < layout.size; x += 1) {
      if (!taken.has(edgeKey('H', x, y))) return { axis: 'H', x, y };
    }
  }
  throw new Error('Keine freie Kante.');
}

describe('Layout-Commands', () => {
  it('faerbt genau das Pinselrechteck und laesst den Rest unveraendert', () => {
    const next = applyLayoutCommand(small, { kind: 'FLOOR', rect, material: 'WOOD' });
    for (let y = 0; y < small.size; y += 1) {
      for (let x = 0; x < small.size; x += 1) {
        const inside = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
        expect(next.floor[y * next.size + x]).toBe(inside ? 'WOOD' : small.floor[y * small.size + x]);
      }
    }
    expect(Object.isFrozen(next.floor)).toBe(true);
    expect(small.floor[rect.y * small.size + rect.x]).not.toBe('WOOD');
  });

  it('lehnt unbekanntes Material und Rechtecke ausserhalb des Rasters ab', () => {
    expect(() => applyLayoutCommand(small, { kind: 'FLOOR', rect, material: 'MARMOR' as never }))
      .toThrow(LayoutContractError);
    expect(() => applyLayoutCommand(small, { kind: 'FLOOR', rect: { x: 28, y: 2, w: 4, h: 1 }, material: 'TILE' }))
      .toThrow(/ausserhalb/);
  });

  it('setzt eine Wandkante, ohne andere Kanten zu verschieben', () => {
    const cell = freeEdge(small);
    const next = applyLayoutCommand(small, { kind: 'EDGES', cells: [cell], edge: 'WALL' });
    const key = edgeKey(cell.axis, cell.x, cell.y);
    const edge = next.edges.find((entry) => edgeKey(entry.axis, entry.x, entry.y) === key);
    expect(edge?.kind).toBe('WALL');
    expect(next.edges.length).toBe(small.edges.length + 1);
    expect(next.edges.filter((entry) => entry.kind === 'DOOR').length).toBe(1);
  });

  it('gibt Tueren eine stabile ID und behaelt sie beim Uebermalen', () => {
    const cell = freeEdge(small);
    const door = applyLayoutCommand(small, { kind: 'EDGES', cells: [cell], edge: 'DOOR' });
    const key = edgeKey(cell.axis, cell.x, cell.y);
    const first = door.edges.find((entry) => edgeKey(entry.axis, entry.x, entry.y) === key);
    expect(first?.id).toBe(`door:${cell.axis}:${cell.x}:${cell.y}`);
    const again = applyLayoutCommand(door, { kind: 'EDGES', cells: [cell], edge: 'DOOR' });
    const second = again.edges.find((entry) => edgeKey(entry.axis, entry.x, entry.y) === key);
    expect(second?.id).toBe(first?.id);
  });

  it('entfernt eine Kante und haelt das Layout gueltig', () => {
    const wall = small.edges.find((edge) => edge.kind === 'WALL');
    if (!wall) throw new Error('Fixture ohne Wand.');
    const next = applyLayoutCommand(small, {
      kind: 'EDGES',
      cells: [{ axis: wall.axis, x: wall.x, y: wall.y }],
      edge: 'NONE',
    });
    const key = edgeKey(wall.axis, wall.x, wall.y);
    expect(next.edges.some((entry) => edgeKey(entry.axis, entry.x, entry.y) === key)).toBe(false);
  });

  it('verweigert das Zumauern der letzten Tuer', () => {
    const door = small.edges.find((edge) => edge.kind === 'DOOR');
    if (!door) throw new Error('Fixture ohne Tuer.');
    expect(() => applyLayoutCommand(small, {
      kind: 'EDGES',
      cells: [{ axis: door.axis, x: door.x, y: door.y }],
      edge: 'WALL',
    })).toThrow(/Durchgang/);
  });

  it('erzeugt fuer dieselbe Absicht dieselben Bytes', () => {
    const first = applyLayoutCommand(small, { kind: 'FLOOR', rect, material: 'CARPET' });
    const second = applyLayoutCommand(small, { kind: 'FLOOR', rect, material: 'CARPET' });
    expect(exportLayout(first)).toBe(exportLayout(second));
  });
});
