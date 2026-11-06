/**
 * @test-target: src/render/depth.ts
 * @error-code: ERR-3001
 *
 * Ein gemeinsamer Tiefenvertrag: Fussanker statt Oberkante, deterministisches
 * Tie-Breaking und Sortierung nur bei echter Aenderung.
 */
import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import type { LayoutEdge } from '../../core/sim/layout-types';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { DepthStage, depthFor, footAnchor } from '../depth';
import { wallBandRect, wallDepthId } from '../wall-art';

const edge = (axis: 'H' | 'V', x: number, y: number): LayoutEdge =>
  ({ axis, x, y, kind: 'WALL', id: null, zoneId: null });

describe('Fussanker', () => {
  it('sortiert nach der Unterkante des Footprints', () => {
    expect(footAnchor(3, 2, TILE)).toBe(5 * TILE);
  });

  it('zieht grosse Objekte nach vorn, ohne ihre Oberkante zu lesen', () => {
    const small = depthFor(footAnchor(10, 1, TILE), 'furniture', 1);
    const tall = depthFor(footAnchor(9, 4, TILE), 'furniture', 2);
    expect(tall).toBeGreaterThan(small);
  });
});

describe('Tie-Breaking', () => {
  it('ist deterministisch und ordnet Typen bei gleichem Anker', () => {
    const anchor = 12 * TILE;
    expect(depthFor(anchor, 'prop', 3)).toBe(depthFor(anchor, 'prop', 3));
    expect(depthFor(anchor, 'prop', 3)).toBeLessThan(depthFor(anchor, 'furniture', 3));
    expect(depthFor(anchor, 'furniture', 3)).toBeLessThan(depthFor(anchor, 'actor', 3));
    expect(depthFor(anchor, 'actor', 3)).toBeLessThan(depthFor(anchor, 'wall', 3));
  });

  it('ordnet gleiche Typen nach stabiler ID', () => {
    const anchor = 12 * TILE;
    expect(depthFor(anchor, 'actor', 4)).toBeLessThan(depthFor(anchor, 'actor', 9));
  });
});

describe('Wand-Occlusion', () => {
  it('legt die Wand vor Figuren im Norden und hinter Figuren im Sueden', () => {
    const view = createWorld('SMALL');
    const wallEdge = edge('H', 10, 10);
    const band = wallBandRect(wallEdge, view.size, TILE);
    const anchor = band.y + band.h;
    const wall = depthFor(anchor, 'wall', wallDepthId(wallEdge));
    expect(wall).toBeGreaterThan(depthFor(footAnchor(9, 0.8, TILE), 'actor', 7));
    expect(wall).toBeLessThan(depthFor(footAnchor(10, 0.8, TILE), 'actor', 7));
  });

  it('gibt jeder Kante eine eindeutige, stabile Sortier-ID', () => {
    const ids = [wallDepthId(edge('H', 4, 7)), wallDepthId(edge('V', 4, 7)), wallDepthId(edge('H', 5, 7))];
    expect(new Set(ids).size).toBe(3);
    expect(wallDepthId(edge('H', 4, 7))).toBe(ids[0]);
  });
});

describe('DepthStage', () => {
  it('sortiert nur, wenn ein Anker oder eine ID gewandert ist', () => {
    const stage = new DepthStage();
    const a = new Container();
    const b = new Container();
    stage.root.addChild(a, b);
    const sort = vi.spyOn(stage.root, 'sortChildren');
    stage.set(a, 100, 'actor', 1);
    stage.set(b, 200, 'actor', 2);
    stage.flush();
    expect(sort).toHaveBeenCalledTimes(1);
    stage.set(a, 100, 'actor', 1);
    stage.flush();
    expect(sort).toHaveBeenCalledTimes(1);
    stage.set(a, 300, 'actor', 1);
    stage.flush();
    expect(sort).toHaveBeenCalledTimes(2);
  });
});
