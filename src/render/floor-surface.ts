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

/** Muster eines Materials; `full` zeichnet die geschlossene Teppichfläche eines Raums. */
export function drawPattern(g: Graphics, mat: FloorMaterial, r: Rect, tile: number, full: boolean): void {
  const { x, y, w, h } = r;
  if (mat.pattern === 'polished') {
    for (let ly = Math.ceil(y / (tile * 2)) * tile * 2; ly < y + h; ly += tile * 2) g.rect(x, ly, w, 1).fill({ color: mat.grout, alpha: 0.55 });
    for (let lx = Math.ceil(x / (tile * 2)) * tile * 2; lx < x + w; lx += tile * 2) g.rect(lx, y, 1, h).fill({ color: mat.grout, alpha: 0.32 });
    g.rect(x + tile, y + tile, Math.max(0, w - tile * 2), 1).fill({ color: mat.light, alpha: 0.06 });
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
  } else if (mat.pattern === 'tiles') {
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

/** Deckenlampen an der oberen Zonenkante: ein Rhythmus aus Leuchten, kein flaechiger Glow. */
export function drawCeilingLight(g: Graphics, r: Rect, light: LightState): void {
  const k = light.intensity;
  g.rect(r.x, r.y, r.w, 2).fill({ color: light.tint, alpha: 0.2 * k });
  g.rect(r.x, r.y + 2, r.w, 10).fill({ color: light.tint, alpha: 0.05 * k });
  g.rect(r.x, r.y + 12, r.w, 14).fill({ color: light.tint, alpha: 0.028 * k });
  for (let lx = r.x + 12; lx < r.x + r.w - 18; lx += 64) {
    g.rect(lx, r.y + 2, 14, 2).fill({ color: light.tint, alpha: 0.62 * k });
    g.rect(lx - 8, r.y + 3, 30, 13).fill({ color: light.tint, alpha: 0.06 * k });
  }
}

/** Lichtpfuetze: das Deckenlicht faellt in vielen leisen Stufen in den Saal. */
export function drawLightSpill(g: Graphics, r: Rect, light: LightState, lightAlpha: number): void {
  const intensity = (lightAlpha / 0.1) * light.intensity;
  const steps = 16;
  for (let step = steps; step >= 1; step -= 1) {
    const t = step / steps;
    g.ellipse(r.x + r.w / 2, r.y + r.h * 0.3, r.w * 0.48 * t, r.h * 0.28 * t)
      .fill({ color: light.tint, alpha: 0.009 * intensity });
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
