/**
 * Raum: Bodenmaterial je Tile aus dem Layout, Waende und Tueren aus den
 * Kanten, darueber nur Licht und Ausstattung der semantischen Zone. Alles
 * statisch, damit die Chunk-Caches weiter nur bei Strukturaenderungen backen.
 */
import type { Container, Graphics } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import type { GameView } from '../store/types';
import { INK, LIGHT, lightFor, materialFor } from './art-tokens';
import { drawCeilingLight, fillBand } from './floor-surface';
import { drawFloorRegion, type FloorTheme } from './floor-material';
import { drawDressing } from './room-dressing';
import { WALL, drawDoors } from './wall-art';

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
 * Die Weltkante laeuft ueber den ganzen Grundriss; in einem Chunk-Cache darf
 * nur der Teil liegen, der in diesem Chunk wirklich sichtbar ist. Ohne Clip
 * zieht die Kante eines 60er-Rasters die Textur des ersten Chunks auf.
 */
function drawWorldRim(g: Graphics, size: number, chunk: Rect): void {
  for (const band of [
    { x: -4, y: -4, w: size + 8, h: 8 },
    { x: -4, y: size - 4, w: size + 8, h: 8 },
    { x: -4, y: 4, w: 8, h: Math.max(0, size - 8) },
    { x: size - 4, y: 4, w: 8, h: Math.max(0, size - 8) },
  ]) fillBand(g, band, INK, 1, chunk);
  for (const line of [
    { x: 4, y: 4, w: size - 8, h: 1 },
    { x: 4, y: size - 5, w: size - 8, h: 1 },
    { x: 4, y: 5, w: 1, h: Math.max(0, size - 10) },
    { x: size - 5, y: 5, w: 1, h: Math.max(0, size - 10) },
  ]) fillBand(g, line, 0x4a3a66, 0.6, chunk);
}

/**
 * Licht und Ausstattung bleiben semantisch: die Zone bestimmt, wie ein Raum
 * wirkt, nie welches Bodenmaterial er hat. Deshalb liegt diese Schicht ueber
 * den Layout-Tiles und nicht in ihrer Aufloesung.
 */
function drawZoneOverlay(
  g: Graphics, zone: ZoneLike, area: Area, tile: number, phase: GameView['dayPhase'], theme: FloorTheme, deco?: Container,
): void {
  if (!clipZone(zone, area, tile)) return;
  // Jeder Chunk backt nur seine eigene Flaeche: eine 60-Tile-Zone darf nicht in
  // den Nachbarchunk hineinragen, sonst zieht die Cache-Textur das ganze Band mit.
  const chunk: Rect = { x: area.x * tile, y: area.y * tile, w: area.w * tile, h: area.h * tile };
  const zoneLight = lightFor(zone.kind, phase);
  // Die Wohnung ist warm beleuchtet; Neon bleibt dem Casino vorbehalten.
  const light = theme === 'apartment' ? { tint: LIGHT.warm, intensity: zoneLight.intensity } : zoneLight;
  // Lichtpfuetze einmal je Zone ueber die volle Flaeche; der Chunk-Cache
  // beschneidet sie, statt sie pro Chunk neu zu zentrieren.
  const full: Rect = {
    x: zone.x * tile + WALL, y: zone.y * tile + WALL,
    w: zone.w * tile - WALL * 2, h: zone.h * tile - WALL * 2,
  };
  if (full.w <= 0 || full.h <= 0) return;
  drawCeilingLight(g, full, light, chunk);
  const originInChunk = zone.x >= area.x && zone.x < area.x + area.w
    && zone.y >= area.y && zone.y < area.y + area.h;
  if (!originInChunk) return;
  drawDressing(g, materialFor(zone.kind), full, zone, tile, deco, light, chunk);
}

export function drawRegionFloor(g: Graphics, view: GameView, area: Area, tile: number, deco?: Container): void {
  const theme: FloorTheme = view.scene.kind === 'APARTMENT' ? 'apartment' : 'casino';
  drawFloorRegion(g, view.layout, area, tile, deco, theme, view.carpet);
  for (const zone of view.zones as readonly ZoneLike[]) {
    drawZoneOverlay(g, zone, area, tile, view.dayPhase, theme, deco);
  }
  drawDoors(g, { size: view.size, layout: view.layout }, area, tile);
  drawWorldRim(g, view.size * tile, { x: area.x * tile, y: area.y * tile, w: area.w * tile, h: area.h * tile });
}

export function drawRegionDirt(g: Graphics, view: GameView, area: Area, tile: number): void {
  for (const mop of view.mops) {
    if (mop.carriedBy !== null) continue;
    if (mop.x < area.x || mop.y < area.y || mop.x >= area.x + area.w || mop.y >= area.y + area.h) continue;
    const cx = mop.x * tile + tile / 2;
    const cy = mop.y * tile + tile / 2;
    g.rect(cx - 1, cy - 12, 2, 12).fill({ color: 0xd8b45a, alpha: 0.9 });
    g.circle(cx, cy - 13, 3).fill({ color: 0xe8cf85, alpha: 0.95 });
    g.ellipse(cx, cy + 1, 6, 3).fill({ color: 0x8e7a4a, alpha: 0.8 });
  }
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
