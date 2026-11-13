/**
 * Bodenflaeche und Licht: Muster je Material, Fugen, Deckenlampen und
 * Kantentiefe. Die Materialwahl kommt aus dem Layout; diese Datei kennt nur
 * die Zeichenregeln und die eine Texturaufloesung (`addTiling`).
 */
import { Graphics, TilingSprite, type Container } from 'pixi.js';
import type { FloorMaterial, LightState } from './art-tokens';
import { textureFor } from './assets/textures';

interface Rect { x: number; y: number; w: number; h: number }

/** Deterministischer Kleckse-Hash: gleiche Kachel, gleicher Fleck, kein Zufall im Cache. */
const speck = (x: number, y: number): number => Math.abs((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) % 97);

/**
 * Muster eines Materials; `full` zeichnet die geschlossene Teppichfläche eines Raums.
 * `clip` haelt auch die Fugen im Chunk: eine Linie 1 px unter der Kante wuerde
 * die Cache-Textur des Chunks verschieben.
 */
export function drawPattern(g: Graphics, mat: FloorMaterial, r: Rect, tile: number, full: boolean, clip?: Rect): void {
  const { x, y, w, h } = r;
  const b = (bx: number, by: number, bw: number, bh: number, color: number, alpha: number): void =>
    fillBand(g, { x: bx, y: by, w: bw, h: bh }, color, alpha, clip);
  if (mat.pattern === 'polished') {
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) b(x, ly, w, 1, mat.grout, 0.55);
    for (let lx = Math.ceil(x / (tile * 2)) * tile * 2; lx < x + w; lx += tile * 2) b(lx, y, 1, h, mat.grout, 0.32);
    b(x + tile, y + tile, Math.max(0, w - tile * 2), 1, mat.light, 0.06);
  } else if (mat.pattern === 'marble') {
    for (let vein = 0; vein < 5; vein += 1) {
      const vy = y + h * (0.1 + vein * 0.19);
      g.moveTo(x + w * 0.06, vy).lineTo(x + w * 0.38, vy - 3).lineTo(x + w * 0.68, vy + 4).lineTo(x + w * 0.95, vy - 1)
        .stroke({ width: 1, color: mat.accent, alpha: 0.14 });
    }
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) b(x, ly, w, 1, mat.grout, 0.34);
  } else if (mat.pattern === 'carpet' || (mat.pattern === 'rug' && !full)) {
    // Teppichfliesen: sichtbare Bahnen, damit ein grosser Saal nicht als Flaeche verschwimmt.
    for (let gy = Math.ceil(y / (tile * 5)) * tile * 5; gy < y + h; gy += tile * 5) b(x, gy, w, 1, 0x000000, 0.28);
    for (let gx = Math.ceil(x / (tile * 5)) * tile * 5; gx < x + w; gx += tile * 5) b(gx, y, 1, h, 0x000000, 0.2);
    for (let gy = y + tile; gy < y + h - tile; gy += tile * 3) {
      for (let gx = x + tile; gx < x + w - tile; gx += tile * 3) {
        b(gx, gy, 3, 2, mat.accent, 0.2);
        b(gx + tile, gy + tile, 2, 1, mat.light, 0.07);
      }
    }
    if (full) g.rect(x + tile * 2, y + tile * 2, w - tile * 4, h - tile * 4).stroke({ width: 1, color: mat.accent, alpha: 0.14 });
  } else if (mat.pattern === 'planks') {
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) {
      b(x, ly, w, 1, mat.grout, 0.6);
      for (let lx = x + tile * 3 + (ly % (tile * 4)); lx < x + w; lx += tile * 4) {
        b(lx, ly - tile * 2, 1, tile * 2, mat.grout, 0.42);
      }
    }
    b(x, y + tile, w, 1, mat.light, 0.05);
  } else if (mat.pattern === 'tiles') {
    for (let ly = Math.ceil(y / tile) * tile; ly < y + h; ly += tile) b(x, ly, w, 1, mat.grout, 0.55);
    for (let lx = Math.ceil(x / tile) * tile; lx < x + w; lx += tile) b(lx, y, 1, h, mat.grout, 0.55);
    b(x + tile + 2, y + tile + 2, 4, 1, mat.light, 0.08);
  } else if (mat.pattern === 'rug') {
    g.roundRect(x + tile, y + tile, w - tile * 2, h - tile * 2, 6)
      .fill({ color: mat.base, alpha: 0.92 })
      .stroke({ width: 2, color: mat.accent, alpha: 0.2 });
    for (let lx = x + tile * 2; lx < x + w - tile * 2; lx += 4) {
      b(lx, y + tile - 2, 1, 3, mat.accent, 0.14);
      b(lx, y + h - tile, 1, 3, mat.accent, 0.14);
    }
  } else {
    for (let gy = y + 3; gy < y + h - 3; gy += tile) {
      for (let gx = x + 3; gx < x + w - 3; gx += tile) {
        if (speck(gx, gy) % 4 !== 0) continue;
        b(gx, gy, 2, 1, mat.grout, 0.5);
      }
    }
    b(x, y + tile * 2, w, 1, 0x000000, 0.18);
  }
}

/**
 * Schneidet ein Rechteck auf den sichtbaren Bereich; `null`, wenn nichts bleibt.
 * Ein 30x30-Chunk backt nur seine eigene Flaeche: eine Zone, die ueber die
 * Chunk-Kante reicht, darf nicht in den Nachbarchunk hineinzeichnen.
 */
export function clipRect(r: Rect, clip?: Rect): Rect | null {
  if (!clip) return r.w > 0 && r.h > 0 ? r : null;
  const x = Math.max(r.x, clip.x);
  const y = Math.max(r.y, clip.y);
  const ex = Math.min(r.x + r.w, clip.x + clip.w);
  const ey = Math.min(r.y + r.h, clip.y + clip.h);
  return ex > x && ey > y ? { x, y, w: ex - x, h: ey - y } : null;
}

/** Eine Flaeche im optionalen Clip-Rechteck; ausserhalb bleibt sie leer. */
export function fillBand(g: Graphics, r: Rect, color: number, alpha: number, clip?: Rect): void {
  const visible = clipRect(r, clip);
  if (!visible) return;
  g.rect(visible.x, visible.y, visible.w, visible.h).fill({ color, alpha });
}

/** Deckenlampen an der oberen Zonenkante: ein Rhythmus aus Leuchten, kein flaechiger Glow. */
export function drawCeilingLight(g: Graphics, r: Rect, light: LightState, clip?: Rect): void {
  const k = light.intensity;
  fillBand(g, { x: r.x, y: r.y, w: r.w, h: 2 }, light.tint, 0.2 * k, clip);
  fillBand(g, { x: r.x, y: r.y + 2, w: r.w, h: 10 }, light.tint, 0.05 * k, clip);
  fillBand(g, { x: r.x, y: r.y + 12, w: r.w, h: 14 }, light.tint, 0.028 * k, clip);
  for (let lx = r.x + 12; lx < r.x + r.w - 18; lx += 64) {
    fillBand(g, { x: lx, y: r.y + 2, w: 14, h: 2 }, light.tint, 0.62 * k, clip);
    fillBand(g, { x: lx - 8, y: r.y + 3, w: 30, h: 13 }, light.tint, 0.06 * k, clip);
  }
}

/**
 * Textur als Kachel ueber eine Flaeche. Gibt das Sprite zurueck, damit ein
 * Material seine Kacheln maskieren kann; fehlt die Datei, bleibt es `null`.
 */
export function addTiling(
  parent: Container | null | undefined, key: string,
  x: number, y: number, w: number, h: number, scale: number, alpha: number,
): TilingSprite | null {
  if (!parent || w <= 0 || h <= 0) return null;
  const texture = textureFor(key);
  if (!texture) return null;
  const tiling = new TilingSprite({ texture, width: w, height: h });
  tiling.position.set(x, y);
  tiling.tileScale.set(scale);
  tiling.alpha = alpha;
  parent.addChild(tiling);
  return tiling;
}
