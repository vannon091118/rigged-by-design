/**
 * Bodenauftrag und Licht: Muster, Fugen, Deckenlampen und Kantentiefe je Raum.
 * Architektur (Waende, Tueren, Zonen) bleibt in room-art; hier liegt nur die Flaeche.
 */
import type { Graphics } from 'pixi.js';
import type { FloorMaterial } from './art-tokens';

interface Rect { x: number; y: number; w: number; h: number }

/** Welche Kanten des Rechtecks echte Zonenkanten sind; Chunk-Grenzen duerfen keine Faelschung erzeugen. */
interface Edges { readonly top: boolean; readonly right: boolean; readonly bottom: boolean; readonly left: boolean }

/** Deterministischer Kleckse-Hash: gleiche Kachel, gleicher Fleck, kein Zufall im Cache. */
const speck = (x: number, y: number): number => Math.abs((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) % 97);

/**
 * Laufwege: dunkler Stein mit Fugen. Bewusst dunkler als jeder Raum, damit die
 * Raeume als Buehne lesen und die Wege dazwischen als Infrastruktur.
 */
export function drawWalkway(g: Graphics, base: number, r: Rect, tile: number): void {
  g.rect(r.x, r.y, r.w, r.h).fill(base);
  g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x000000, alpha: 0.34 });
  for (let x = Math.round(r.x); x < r.x + r.w; x += tile) g.rect(x, r.y, 1, r.h).fill({ color: 0xffffff, alpha: 0.035 });
  for (let y = Math.round(r.y); y < r.y + r.h; y += tile) g.rect(r.x, y, r.w, 1).fill({ color: 0x000000, alpha: 0.2 });
  for (let gy = Math.round(r.y) + tile; gy < r.y + r.h; gy += tile * 4) {
    for (let gx = Math.round(r.x) + tile; gx < r.x + r.w; gx += tile * 4) {
      if (speck(gx, gy) % 3 !== 0) continue;
      g.rect(gx + 4, gy + 6, 3, 1).fill({ color: 0xffffff, alpha: 0.05 });
    }
  }
}

function drawPattern(g: Graphics, mat: FloorMaterial, r: Rect, tile: number, full: boolean): void {
  const { x, y, w, h } = r;
  if (mat.pattern === 'polished') {
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) g.rect(x, ly, w, 1).fill({ color: mat.grout, alpha: 0.55 });
    for (let lx = Math.ceil(x / (tile * 2)) * tile * 2; lx < x + w; lx += tile * 2) g.rect(lx, y, 1, h).fill({ color: mat.grout, alpha: 0.32 });
    g.rect(x + tile, y + tile, w - tile * 2, 1).fill({ color: mat.light, alpha: 0.06 });
  } else if (mat.pattern === 'marble') {
    for (let vein = 0; vein < 5; vein += 1) {
      const vy = y + h * (0.1 + vein * 0.19);
      g.moveTo(x + w * 0.06, vy).lineTo(x + w * 0.38, vy - 3).lineTo(x + w * 0.68, vy + 4).lineTo(x + w * 0.95, vy - 1)
        .stroke({ width: 1, color: mat.accent, alpha: 0.14 });
    }
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) g.rect(x, ly, w, 1).fill({ color: mat.grout, alpha: 0.34 });
  } else if (mat.pattern === 'carpet' || (mat.pattern === 'rug' && !full)) {
    // Teppichfliesen: sichtbare Bahnen, damit ein grosser Saal nicht als Flaeche verschwimmt.
    for (let gy = Math.ceil(y / (tile * 5)) * tile * 5; gy < y + h; gy += tile * 5) g.rect(x, gy, w, 1).fill({ color: 0x000000, alpha: 0.28 });
    for (let gx = Math.ceil(x / (tile * 5)) * tile * 5; gx < x + w; gx += tile * 5) g.rect(gx, y, 1, h).fill({ color: 0x000000, alpha: 0.2 });
    for (let gy = y + tile; gy < y + h - tile; gy += tile * 3) {
      for (let gx = x + tile; gx < x + w - tile; gx += tile * 3) {
        g.rect(gx, gy, 3, 2).fill({ color: mat.accent, alpha: 0.2 });
        g.rect(gx + tile, gy + tile, 2, 1).fill({ color: mat.light, alpha: 0.07 });
      }
    }
    if (full) g.rect(x + tile * 2, y + tile * 2, w - tile * 4, h - tile * 4).stroke({ width: 1, color: mat.accent, alpha: 0.14 });
  } else if (mat.pattern === 'planks') {
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) {
      g.rect(x, ly, w, 1).fill({ color: mat.grout, alpha: 0.6 });
      for (let lx = x + tile * 3 + (ly % (tile * 4)); lx < x + w; lx += tile * 4) {
        g.rect(lx, ly - tile * 2, 1, tile * 2).fill({ color: mat.grout, alpha: 0.42 });
      }
    }
    g.rect(x, y + tile, w, 1).fill({ color: mat.light, alpha: 0.05 });
  } else  if (mat.pattern === 'tiles') {
    for (let ly = Math.ceil(y / tile) * tile; ly < y + h; ly += tile) g.rect(x, ly, w, 1).fill({ color: mat.grout, alpha: 0.55 });
    for (let lx = Math.ceil(x / tile) * tile; lx < x + w; lx += tile) g.rect(lx, y, 1, h).fill({ color: mat.grout, alpha: 0.55 });
    g.rect(x + tile + 2, y + tile + 2, 4, 1).fill({ color: mat.light, alpha: 0.08 });
  } else if (mat.pattern === 'rug') {
    g.roundRect(x + tile, y + tile, w - tile * 2, h - tile * 2, 6)
      .fill({ color: mat.base, alpha: 0.92 })
      .stroke({ width: 2, color: mat.accent, alpha: 0.2 });
    for (let lx = x + tile * 2; lx < x + w - tile * 2; lx += 4) {
      g.rect(lx, y + tile - 2, 1, 3).fill({ color: mat.accent, alpha: 0.14 });
      g.rect(lx, y + h - tile, 1, 3).fill({ color: mat.accent, alpha: 0.14 });
    }
  } else {
    for (let gy = y + 3; gy < y + h - 3; gy += tile) {
      for (let gx = x + 3; gx < x + w - 3; gx += tile) {
        if (speck(gx, gy) % 4 !== 0) continue;
        g.rect(gx, gy, 2, 1).fill({ color: mat.grout, alpha: 0.5 });
      }
    }
    g.rect(x, y + tile * 2, w, 1).fill({ color: 0x000000, alpha: 0.18 });
  }
}

/** Deckenlampen an der oberen Wand: ein Rhythmus aus Leuchten, kein flaechiger Glow. */
function drawCeilingLight(g: Graphics, mat: FloorMaterial, r: Rect): void {
  // Nur an einer echten Zonenkante: sonst zieht eine Chunk-Grenze eine Scheinleuchte mitten in den Saal.
  g.rect(r.x, r.y, r.w, 2).fill({ color: mat.light, alpha: 0.14 });
  g.rect(r.x, r.y + 2, r.w, 10).fill({ color: mat.light, alpha: 0.032 });
  g.rect(r.x, r.y + 12, r.w, 14).fill({ color: mat.light, alpha: 0.018 });
  for (let lx = r.x + 12; lx < r.x + r.w - 18; lx += 64) {
    g.rect(lx, r.y + 2, 14, 2).fill({ color: mat.light, alpha: 0.5 });
    g.rect(lx - 8, r.y + 3, 30, 13).fill({ color: mat.light, alpha: 0.04 });
  }
}

/** Kantentiefe: drei Stufen Schatten nach innen, damit der Raum einen Boden bekommt. */
function drawInset(g: Graphics, r: Rect, edges: Edges): void {
  const steps: readonly (readonly [number, number])[] = [[0, 0.09], [2, 0.05], [5, 0.03]];
  for (const [inset, alpha] of steps) {
    const w = r.w - inset * 2;
    const h = r.h - inset * 2;
    if (w <= 0 || h <= 0) continue;
    if (edges.top) g.rect(r.x + inset, r.y + inset, w, 2).fill({ color: 0x000000, alpha });
    if (edges.bottom) g.rect(r.x + inset, r.y + r.h - inset - 2, w, 2).fill({ color: 0x000000, alpha });
    if (edges.left) g.rect(r.x + inset, r.y + inset, 2, h).fill({ color: 0x000000, alpha });
    if (edges.right) g.rect(r.x + r.w - inset - 2, r.y + inset, 2, h).fill({ color: 0x000000, alpha });
  }
}

/** Ein Bodenbelag: Material, Muster, Licht und Tiefe in einem Auftrag. */
export function drawSurface(g: Graphics, mat: FloorMaterial, r: Rect, tile: number, edges: Edges): void {
  g.rect(r.x, r.y, r.w, r.h).fill(mat.base);
  drawPattern(g, mat, r, tile, edges.top && edges.bottom && edges.left && edges.right);
  if (edges.top) drawCeilingLight(g, mat, r);
  drawInset(g, r, edges);
}
