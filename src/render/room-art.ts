/**
 * Raum: Bodenmaterial je Tile aus dem Layout, Waende und Tueren aus den
 * Kanten, darueber nur Licht und Ausstattung der semantischen Zone. Alles
 * statisch, damit die Chunk-Caches weiter nur bei Strukturaenderungen backen.
 */
import type { Container, Graphics } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import type { GameView } from '../store/types';
import { INK, lightFor, materialFor } from './art-tokens';
import { drawCeilingLight, drawLightSpill } from './floor-surface';
import { drawFloorRegion } from './floor-material';
import { drawDressing } from './room-dressing';
import { WALL, drawWalls } from './wall-art';

interface Rect { x: number; y: number; w: number; h: number }
interface ZoneLike { id: string; kind: string; x: number; y: number; w: number; h: number }

/** Zonenrechteck auf den Chunk beschnitten; `null`, wenn sie sich nicht treffen. */
function clipZone(zone: ZoneLike, area: Area, tile: number): Rect | null {
  const ix = Math.max(zone.x, area.x);
  const iy = Math.max(zone.y, area.y);
  const ex = Math.min(zone.x + zone.w, area.x + area.w);
  const ey = Math.min(zone.y + zone.h, area.y + area.h);
  if (ex <= ix || ey <= iy) return null;
  return { x: ix * tile, y: iy * tile, w: (ex - ix) * tile, h: (ey - iy) * tile };
}

/**
 * Licht und Ausstattung bleiben semantisch: die Zone bestimmt, wie ein Raum
 * wirkt, nie welches Bodenmaterial er hat. Deshalb liegt diese Schicht ueber
 * den Layout-Tiles und nicht in ihrer Aufloesung.
 */
function drawZoneOverlay(g: Graphics, zone: ZoneLike, area: Area, tile: number, phase: GameView['dayPhase'], deco?: Container): void {
  if (!clipZone(zone, area, tile)) return;
  const light = lightFor(zone.kind, phase);
  // Lichtpfuetze einmal je Zone ueber die volle Flaeche; der Chunk-Cache
  // beschneidet sie, statt sie pro Chunk neu zu zentrieren.
  const full: Rect = {
    x: zone.x * tile + WALL, y: zone.y * tile + WALL,
    w: zone.w * tile - WALL * 2, h: zone.h * tile - WALL * 2,
  };
  if (full.w <= 0 || full.h <= 0) return;
  drawLightSpill(g, full, light, 0.08);
  const originInChunk = zone.x >= area.x && zone.x < area.x + area.w
    && zone.y >= area.y && zone.y < area.y + area.h;
  if (!originInChunk) return;
  drawCeilingLight(g, full, light);
  drawDressing(g, materialFor(zone.kind), full, zone, tile, deco, light);
}

export function drawRegionFloor(g: Graphics, view: GameView, area: Area, tile: number, deco?: Container): void {
  drawFloorRegion(g, view.layout, area, tile, deco);
  for (const zone of view.zones as readonly ZoneLike[]) {
    drawZoneOverlay(g, zone, area, tile, view.dayPhase, deco);
  }
  drawWalls(g, { size: view.size, layout: view.layout }, area, tile, deco);
  if (area.x === 0 && area.y === 0) {
    const size = view.size * tile;
    g.rect(0, 0, size, size).stroke({ width: 8, color: INK });
    g.rect(4, 4, size - 8, size - 8).stroke({ width: 1, color: 0x4a3a66, alpha: 0.6 });
  }
}

export function drawRegionDirt(g: Graphics, view: GameView, area: Area, tile: number): void {
  for (const index of view.dirtyTiles) {
    const x = index % view.size;
    const y = Math.floor(index / view.size);
    if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) continue;
    const cx = x * tile + tile / 2;
    const cy = y * tile + tile / 2;
    g.ellipse(cx, cy, 8, 4.5).fill({ color: 0x45311d, alpha: 0.62 });
    g.ellipse(cx + 1, cy + 1, 4.5, 2.2).fill({ color: 0x2a1c10, alpha: 0.55 });
    g.circle(cx + 5, cy - 3, 2.6).fill({ color: 0x35241a, alpha: 0.7 });
    g.circle(cx - 4, cy + 2, 1.8).fill({ color: 0x35241a, alpha: 0.55 });
  }
}
