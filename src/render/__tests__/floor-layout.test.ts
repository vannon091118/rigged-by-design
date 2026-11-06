/**
 * @test-target: src/render/floor-material.ts
 * @error-code: ERR-3001
 *
 * Bodenmaterialien kommen aus dem Layout, nicht aus Zonen. Fallback-IDs,
 * Texturaufloesung, Wandgeometrie und die chunk-genaue Invalidierung muessen
 * deterministisch bleiben.
 */
import { describe, expect, it } from 'vitest';
import { areasFor } from '../../core/sim/grid-zones';
import { FLOOR_MATERIALS, type FloorMaterialId, type LayoutState } from '../../core/sim/layout-types';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { changedRegions, regionHash, wallOwnerTile } from '../floor-math';
import {
  FLOOR_FALLBACK_IDS,
  floorArtFor,
  floorRuns,
  floorTextureKey,
  materialAt,
} from '../floor-material';
import { doorParts, wallBandRect, wallFaceRect } from '../wall-art';

const SIZE = 30;

function layoutWith(change: (floor: FloorMaterialId[]) => void, edges: LayoutState['edges'] = []): LayoutState {
  const base = createWorld('MEDIUM').layout;
  const floor = [...base.floor];
  change(floor);
  return { ...base, floor, edges: [...base.edges, ...edges] };
}

function viewOf(layout: LayoutState, zones = createWorld('MEDIUM').zones) {
  return {
    size: layout.size,
    template: 'MEDIUM' as const,
    carpet: 'VIOLET' as const,
    zones,
    furniture: [],
    dirtyTiles: new Set<number>(),
    layout,
  };
}

const edge = (axis: 'H' | 'V', x: number, y: number, kind: 'WALL' | 'DOOR' | 'OPENING') =>
  ({ axis, x, y, kind, id: kind === 'WALL' ? null : `${kind}-${axis}-${x}-${y}`, zoneId: null });

describe('Materialaufloesung', () => {
  it('gibt jedem Bodenmaterial eine stabile, eindeutige Fallback-ID', () => {
    const ids = FLOOR_MATERIALS.map((material) => FLOOR_FALLBACK_IDS[material]);
    expect(new Set(ids).size).toBe(FLOOR_MATERIALS.length);
    expect(ids.every((id) => /^floor-material-[a-z]+-procedural-v1$/.test(id))).toBe(true);
  });

  it('erfindet keine Texturen fuer Holz, Fliese, Stein, Linoleum und Beton', () => {
    expect(['WOOD', 'TILE', 'STONE', 'LINOLEUM', 'CONCRETE']
      .map((material) => floorTextureKey(material as FloorMaterialId))).toEqual([null, null, null, null, null]);
    expect(floorTextureKey('CARPET')).toBe('environment/tiles/casino-carpet-plum.png');
  });

  it('faellt bei unbekannter ID auf Beton mit dessen stabiler ID zurueck', () => {
    expect(floorArtFor('LAVA' as FloorMaterialId).fallbackId).toBe(FLOOR_FALLBACK_IDS.CONCRETE);
  });

  it('liest das Material aus dem Layout und nicht aus der Zone', () => {
    const layout = createWorld('SMALL').layout;
    const gaming = createWorld('SMALL').zones.find((zone) => zone.kind === 'GAMING')!;
    expect(materialAt(layout, gaming.x + 1, gaming.y + 1)).toBe(layout.floor[(gaming.y + 1) * layout.size + gaming.x + 1]);
  });

  it('buendelt Tiles gleichen Materials zu Laeufen', () => {
    const layout = layoutWith((floor) => { floor[0] = 'WOOD'; floor[1] = 'WOOD'; floor[2] = 'TILE'; });
    const runs = floorRuns(layout, { id: 'area-0', index: 0, x: 0, y: 0, w: SIZE, h: SIZE });
    expect(runs.slice(0, 3).map((run) => [run.x, run.w, run.material])).toEqual([[0, 2, 'WOOD'], [2, 1, 'TILE'], [3, 27, layout.floor[3]]]);
  });
});

describe('Wand- und Tuergeometrie', () => {
  it('legt jedes Wandband in die Besitzer-Kachel', () => {
    const h = wallBandRect(edge('H', 4, 7, 'WALL'), SIZE, TILE);
    const v = wallBandRect(edge('V', 7, 4, 'WALL'), SIZE, TILE);
    expect([h.x, h.y, h.w, h.h]).toEqual([4 * TILE, 7 * TILE, TILE, 6]);
    expect([v.x, v.y, v.w, v.h]).toEqual([7 * TILE, 4 * TILE, 6, TILE]);
  });

  it('zieht Randkanten in das Raster, statt aus dem Floor zu ragen', () => {
    const bottom = wallBandRect(edge('H', 3, SIZE, 'WALL'), SIZE, TILE);
    const right = wallBandRect(edge('V', SIZE, 3, 'WALL'), SIZE, TILE);
    expect(bottom.y).toBe(SIZE * TILE - 6);
    expect(right.x).toBe(SIZE * TILE - 6);
    expect(wallOwnerTile({ axis: 'V', x: SIZE, y: 3 }, SIZE)).toEqual({ x: SIZE - 1, y: 3 });
  });

  it('zeichnet die Vorderseite an Sued- bzw. Ostkante des Bands', () => {
    const h = edge('H', 4, 7, 'WALL');
    const v = edge('V', 7, 4, 'WALL');
    expect(wallFaceRect(h, SIZE, TILE).y).toBe(7 * TILE + 6 - 3);
    expect(wallFaceRect(v, SIZE, TILE).x).toBe(7 * TILE + 6 - 3);
  });

  it('gibt Tueren Pfosten, Durchgaengen nur eine Schwelle', () => {
    const door = doorParts(edge('H', 5, 5, 'DOOR'), SIZE, TILE);
    const opening = doorParts(edge('H', 5, 5, 'OPENING'), SIZE, TILE);
    expect(door.posts).toHaveLength(2);
    expect(opening.posts).toEqual([]);
    expect(door.threshold).toEqual(wallBandRect(edge('H', 5, 5, 'DOOR'), SIZE, TILE));
  });
});

describe('Chunk-Invalidierung', () => {
  const areas = areasFor('MEDIUM');
  const zone = { id: 'gaming', kind: 'GAMING' as const, name: 'Gaming', x: 35, y: 5, w: 20, h: 20, color: 1 };

  it('backt bei einer einzelnen Tile-Aenderung nur den betroffenen Chunk neu', () => {
    const base = viewOf(layoutWith(() => undefined), [zone]);
    const prev = new Map(areas.map((area) => [area.id, regionHash(base as never, area)]));
    const changedLayout = layoutWith((floor) => {
      const index = 5 * 60 + 35;
      floor[index] = floor[index] === 'WOOD' ? 'STONE' : 'WOOD';
    });
    expect(changedRegions(viewOf(changedLayout, [zone]) as never, areas, prev)).toEqual(['area-1']);
  });

  it('erkennt eine neue Wandkante in genau ihrem Chunk', () => {
    const base = viewOf(layoutWith(() => undefined), [zone]);
    const prev = new Map(areas.map((area) => [area.id, regionHash(base as never, area)]));
    const walled = layoutWith(() => undefined, [edge('H', 40, 10, 'WALL')]);
    expect(changedRegions(viewOf(walled, [zone]) as never, areas, prev)).toEqual(['area-1']);
  });

  it('haelt den Hash stabil, solange dasselbe Layout-Objekt gilt', () => {
    const layout = layoutWith(() => undefined);
    const view = viewOf(layout, [zone]);
    const first = regionHash(view as never, areas[0]!);
    expect(regionHash(view as never, areas[0]!)).toBe(first);
    expect(regionHash(viewOf({ ...layout, floor: [...layout.floor] }, [zone]) as never, areas[0]!)).toBe(first);
  });
});
