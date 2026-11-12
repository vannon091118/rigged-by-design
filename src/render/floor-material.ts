/**
 * Bodenmaterialien aus dem Layout: pro `FloorMaterialId` genau eine
 * Darstellung, eine optionale Manifest-Textur und eine stabile Fallback-ID.
 * Keine Zone entscheidet hier mit; Zonen liefern nur Licht und Ausstattung.
 */
import { Graphics, type Container } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { FLOOR_MATERIALS, type FloorMaterialId, type LayoutState } from '../core/sim/layout-types';
import { LIGHT, ROLE, type FloorMaterial } from './art-tokens';
import { addTiling, drawPattern } from './floor-surface';

interface FloorArt extends FloorMaterial {
  /** Pfad aus dem Manifest oder `null`: dann bleibt es beim prozeduralen Muster. */
  readonly texture: string | null;
  /** Stabile ID des prozeduralen Fallbacks, auch wenn spaeter eine Textur kommt. */
  readonly fallbackId: string;
}

/**
 * Nur der Teppich existiert als Environment-Textur. Holz, Fliese, Stein,
 * Linoleum und Beton bleiben prozedural, bis echte Assets im Manifest stehen;
 * hier wird kein Pfad erfunden.
 */
const CARPET = 'environment/tiles/casino-carpet-plum.png';

export type FloorTheme = 'casino' | 'apartment';

const FLOOR_ART: Readonly<Record<FloorMaterialId, FloorArt>> = {
  CARPET: { base: 0x241a3d, grout: 0x342650, accent: ROLE.identity, pattern: 'carpet', light: LIGHT.neon, lightAlpha: 0.06, texture: CARPET, fallbackId: 'floor-material-carpet-procedural-v1' },
  WOOD: { base: 0x3a2a1b, grout: 0x261a10, accent: 0x8a5a34, pattern: 'planks', light: LIGHT.warm, lightAlpha: 0.1, texture: null, fallbackId: 'floor-material-wood-procedural-v1' },
  TILE: { base: 0x222a33, grout: 0x3c4a58, accent: LIGHT.cool, pattern: 'tiles', light: LIGHT.cool, lightAlpha: 0.08, texture: null, fallbackId: 'floor-material-tile-procedural-v1' },
  STONE: { base: 0x2a2733, grout: 0x413c4d, accent: 0x9a8fb0, pattern: 'marble', light: LIGHT.cool, lightAlpha: 0.07, texture: null, fallbackId: 'floor-material-stone-procedural-v1' },
  LINOLEUM: { base: 0x1f2a2a, grout: 0x2e4444, accent: ROLE.service, pattern: 'polished', light: LIGHT.cool, lightAlpha: 0.08, texture: null, fallbackId: 'floor-material-linoleum-procedural-v1' },
  CONCRETE: { base: 0x1b1a22, grout: 0x2c2a36, accent: 0x6a6580, pattern: 'concrete', light: LIGHT.cool, lightAlpha: 0.04, texture: null, fallbackId: 'floor-material-concrete-procedural-v1' },
};

/**
 * Wohnung: warme, matte Boeden statt Casino-Glanz. Der Teppich bleibt Teppich,
 * aber ohne die violette Casino-Textur und ohne Neonfarben.
 */
const APARTMENT_FLOOR_ART: Partial<Record<FloorMaterialId, FloorArt>> = {
  CARPET: { base: 0x3d2b25, grout: 0x4e3830, accent: 0xc08a62, pattern: 'rug', light: LIGHT.warm, lightAlpha: 0.09, texture: null, fallbackId: 'floor-material-apartment-rug-procedural-v1' },
  WOOD: { base: 0x4a3423, grout: 0x322317, accent: 0xa97a4c, pattern: 'planks', light: LIGHT.warm, lightAlpha: 0.11, texture: null, fallbackId: 'floor-material-wood-procedural-v1' },
  TILE: { base: 0x2b3438, grout: 0x45535a, accent: 0x9fc4cc, pattern: 'tiles', light: LIGHT.cool, lightAlpha: 0.07, texture: null, fallbackId: 'floor-material-tile-procedural-v1' },
  LINOLEUM: { base: 0x3c3328, grout: 0x4e4234, accent: 0xc2a070, pattern: 'polished', light: LIGHT.warm, lightAlpha: 0.08, texture: null, fallbackId: 'floor-material-linoleum-procedural-v1' },
  STONE: { base: 0x35302b, grout: 0x4a443c, accent: 0x9a8f80, pattern: 'marble', light: LIGHT.warm, lightAlpha: 0.06, texture: null, fallbackId: 'floor-material-stone-procedural-v1' },
};

const UNKNOWN: FloorArt = FLOOR_ART.CONCRETE;

export const floorArtFor = (id: FloorMaterialId, theme: FloorTheme = 'casino'): FloorArt =>
  (theme === 'apartment' ? APARTMENT_FLOOR_ART[id] : undefined) ?? FLOOR_ART[id] ?? UNKNOWN;

/** Stabile IDs aller prozeduralen Bodenmaterialien; Test und Editor lesen dieselbe Liste. */
export const FLOOR_FALLBACK_IDS: Readonly<Record<FloorMaterialId, string>> = Object.freeze(
  Object.fromEntries(FLOOR_MATERIALS.map((id) => [id, FLOOR_ART[id].fallbackId])) as Record<FloorMaterialId, string>,
);

/** Nur Materialien mit echter Manifest-Textur liefern einen Pfad. */
export const floorTextureKey = (id: FloorMaterialId, theme: FloorTheme = 'casino'): string | null =>
  floorArtFor(id, theme).texture;

export const materialAt = (layout: LayoutState, x: number, y: number): FloorMaterialId | null => {
  if (x < 0 || y < 0 || x >= layout.size || y >= layout.size) return null;
  return (layout.floor[y * layout.size + x] as FloorMaterialId | undefined) ?? null;
};

interface FloorRun {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly material: FloorMaterialId;
}

/** Zeilenweise gleiche Materialien zu Laeufen buendeln: weniger Fuellungen, gleiche Optik. */
export function floorRuns(layout: LayoutState, area: Area): FloorRun[] {
  const runs: FloorRun[] = [];
  const size = layout.size;
  const x0 = Math.max(0, area.x);
  const x1 = Math.min(size, area.x + area.w);
  const y0 = Math.max(0, area.y);
  const y1 = Math.min(size, area.y + area.h);
  for (let y = y0; y < y1; y += 1) {
    let start = x0;
    while (start < x1) {
      const material = layout.floor[y * size + start]!;
      let end = start + 1;
      while (end < x1 && layout.floor[y * size + end] === material) end += 1;
      runs.push({ x: start, y, w: end - start, material });
      start = end;
    }
  }
  return runs;
}

/**
 * Boden eines 30×30-Chunks: Grundflaeche und Muster je Tile-Lauf, darueber die
 * Manifest-Textur nur fuer Materialien, die eine haben. Die Textur liegt als
 * ein TilingSprite je Material ueber dem Chunk und wird auf dessen Tiles
 * maskiert; so wiederholt sie sich ohne Naht an Laufgrenzen.
 */
export function drawFloorRegion(
  g: Graphics, layout: LayoutState | null | undefined, area: Area, tile: number, deco?: Container,
  theme: FloorTheme = 'casino',
): void {
  if (!layout) return;
  const runs = floorRuns(layout, area);
  for (const run of runs) {
    const rect = { x: run.x * tile, y: run.y * tile, w: run.w * tile, h: tile };
    const art = floorArtFor(run.material, theme);
    g.rect(rect.x, rect.y, rect.w, rect.h).fill(art.base);
    drawPattern(g, art, rect, tile, false);
  }
  if (!deco) return;
  const byMaterial = new Map<FloorMaterialId, FloorRun[]>();
  for (const run of runs) {
    const key = run.material;
    const list = byMaterial.get(key);
    if (list) list.push(run); else byMaterial.set(key, [run]);
  }
  for (const [material, materialRuns] of byMaterial) {
    const key = floorTextureKey(material, theme);
    if (!key) continue;
    const tiling = addTiling(deco, key, area.x * tile, area.y * tile, area.w * tile, area.h * tile, 2, 0.5);
    if (!tiling) continue;
    const mask = new Graphics();
    for (const run of materialRuns) mask.rect(run.x * tile, run.y * tile, run.w * tile, tile).fill(0xffffff);
    deco.addChild(mask);
    tiling.mask = mask;
  }
}
