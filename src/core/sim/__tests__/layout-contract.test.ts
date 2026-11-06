/**
 * @test-target: src/core/sim/layout-derive.ts
 * @error-code: ERR-2002
 *
 * Layout-Vertrag: eine Wahrheit fuer Dimension, Boden, Zonen und Wandkanten.
 */
import { describe, expect, it } from 'vitest';
import { applyLayout } from '../layout';
import { doorsOfLayout, floorMaterialAt, layoutFromTemplate, layoutWithZones, zonesFromLayout } from '../layout-derive';
import { edgeKey } from '../layout-edges';
import { parseLayout } from '../layout-validate';
import { createWorld } from '../templates';
import { doorPoint } from '../world';
import type { LayoutState } from '../layout-types';

const clone = (layout: LayoutState): Record<string, unknown> => JSON.parse(JSON.stringify(layout)) as Record<string, unknown>;

describe('Layout-Vertrag', () => {
  it('leitet fuer jede Vorlage einen gueltigen Plan ab', () => {
    const sizes = { SMALL: 30, MEDIUM: 60, LARGE: 90 } as const;
    for (const template of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      const layout = layoutFromTemplate(template);
      expect(layout.size).toBe(sizes[template]);
      expect(layout.floor).toHaveLength(layout.size * layout.size);
      expect(layout.zones.length).toBeGreaterThan(0);
      expect(parseLayout(layout).ok).toBe(true);
    }
  });

  it('haelt Weltgroesse und Zonen deckungsgleich mit dem Plan', () => {
    const world = createWorld('MEDIUM');
    expect(world.size).toBe(world.layout.size);
    expect(world.zones).toEqual(zonesFromLayout(world.layout));
    applyLayout(world, layoutFromTemplate('SMALL'));
    expect(world.layout.size).toBe(30);
    expect(world.size).toBe(30);
    expect(world.zones.map((zone) => zone.id)).toEqual(layoutFromTemplate('SMALL').zones.map((zone) => zone.id));
  });

  it('gibt jeder Kante genau einen Zustand', () => {
    const layout = layoutFromTemplate('SMALL');
    const keys = layout.edges.map((edge) => edgeKey(edge.axis, edge.x, edge.y));
    const doors = doorsOfLayout(layout);
    expect(new Set(keys).size).toBe(keys.length);
    expect(doors).toHaveLength(1);
    expect(new Set(doors.map((door) => door.id)).size).toBe(1);
    expect(layout.edges.filter((edge) => edge.kind === 'WALL')).toHaveLength(layout.size * 4 - doors.length);
  });

  it('setzt die Eingangstuer auf die Kante des Tuerpunkts', () => {
    const world = createWorld('SMALL');
    const door = doorsOfLayout(world.layout)[0]!;
    const point = doorPoint(world);
    expect({ axis: door.axis, x: door.x, y: door.y }).toEqual({ axis: 'V', x: 0, y: point.y });
    expect(door.zoneId).toBe('entrance');
    const sameEdge = world.layout.edges.filter((edge) => edgeKey(edge.axis, edge.x, edge.y) === edgeKey('V', 0, point.y));
    expect(sameEdge.map((edge) => edge.kind)).toEqual(['DOOR']);
  });

  it('gibt jedem Tile das Bodenmaterial seiner Zone', () => {
    const layout = layoutFromTemplate('SMALL');
    expect(floorMaterialAt(layout, 16, 6)).toBe('CARPET');
    expect(floorMaterialAt(layout, 14, 19)).toBe('WOOD');
    expect(floorMaterialAt(layout, 0, 0)).toBe('CONCRETE');
    expect(floorMaterialAt(layout, -1, 0)).toBeNull();
    expect(floorMaterialAt(layout, layout.size, 0)).toBeNull();
  });

  it('weist ungueltige Groessen, Boeden und Zonen fail-closed ab', () => {
    const raw = clone(layoutFromTemplate('SMALL'));
    expect(parseLayout({ ...raw, size: 45 }).ok).toBe(false);
    expect(parseLayout({ ...raw, floor: (raw.floor as unknown[]).slice(0, 10) }).ok).toBe(false);
    expect(parseLayout({ ...raw, floor: ['MARMOR', ...(raw.floor as unknown[]).slice(1)] }).ok).toBe(false);
    expect(parseLayout({ ...raw, zones: [{ ...(raw.zones as Record<string, unknown>[])[0], x: 28, w: 9 }] }).ok).toBe(false);
    expect(parseLayout({ ...raw, zones: [{ ...(raw.zones as Record<string, unknown>[])[0], w: 0 }] }).ok).toBe(false);
    expect(parseLayout(null).ok).toBe(false);
  });

  it('weist doppelte und widerspruechliche Kanten ab', () => {
    const raw = clone(layoutFromTemplate('SMALL'));
    const edges = raw.edges as Record<string, unknown>[];
    const wall = edges.find((edge) => edge.kind === 'WALL')!;
    const door = edges.find((edge) => edge.kind === 'DOOR')!;
    expect(parseLayout({ ...raw, edges: [...edges, wall] }).ok).toBe(false);
    expect(parseLayout({ ...raw, edges: [...edges, { ...wall, axis: door.axis, x: door.x, y: door.y }] }).ok).toBe(false);
    expect(parseLayout({ ...raw, edges: [...edges, { ...door, y: (door.y as number) + 1 }] }).ok).toBe(false);
    expect(parseLayout({ ...raw, edges: edges.map((edge) => (edge.kind === 'WALL' ? { ...edge, id: 'wall-1' } : edge)) }).ok).toBe(false);
    expect(parseLayout({ ...raw, edges: edges.map((edge) => (edge.kind === 'WALL' ? edge : { ...edge, id: null })) }).ok).toBe(false);
  });

  it('weist unaufloesbare Referenzen und doppelte Zonen ab', () => {
    const raw = clone(layoutFromTemplate('SMALL'));
    const edges = raw.edges as Record<string, unknown>[];
    const zones = raw.zones as Record<string, unknown>[];
    expect(parseLayout({ ...raw, edges: edges.map((edge) => (edge.kind === 'DOOR' ? { ...edge, zoneId: 'gibtsnicht' } : edge)) }).ok).toBe(false);
    expect(parseLayout({ ...raw, zones: [...zones, zones[0]] }).ok).toBe(false);
  });

  it('verlangt mindestens einen Durchgang', () => {
    const raw = clone(layoutFromTemplate('SMALL'));
    const sealed = (raw.edges as Record<string, unknown>[]).map((edge) => (
      edge.kind === 'WALL' ? edge : { ...edge, kind: 'WALL', id: null, zoneId: null }
    ));
    const parsed = parseLayout({ ...raw, edges: sealed });
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? [] : parsed.issues).toContain('Kein Durchgang: das Haus waere geschlossen.');
  });

  it('oeffnet beim Ausbau die alte Aussenwand und behaelt Tuer und Boden', () => {
    const before = layoutFromTemplate('SMALL');
    const added = { id: 'exp-1', name: 'Erweiterung', kind: 'EXPANSION' as const, x: 30, y: 30, w: 4, h: 4, color: 0x2f2a3d };
    const after = layoutWithZones(before, 60, [added]);
    expect(after.size).toBe(60);
    expect(after.zones.map((zone) => zone.id)).toContain('exp-1');
    expect(parseLayout(after).ok).toBe(true);
    expect(doorsOfLayout(after).map((door) => door.id)).toContain('door-entrance');
    expect(after.edges.some((edge) => edge.axis === 'V' && edge.x === 30 && edge.kind === 'WALL')).toBe(false);
    expect(floorMaterialAt(after, 16, 6)).toBe('CARPET');
    expect(floorMaterialAt(after, 31, 31)).toBe('CONCRETE');
  });
});
