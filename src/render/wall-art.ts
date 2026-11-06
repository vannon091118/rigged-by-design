/**
 * Waende, Tueren und Ecken aus den gespeicherten Kanten. Jede Kante gehoert
 * genau einer Kachel (Sued- bzw. Ostseite); damit zeichnet jeder Chunk nur
 * seine eigenen Waende und keine Kante wird doppelt dargestellt.
 *
 * Die Geometrie liegt hier als reine Funktion, damit die spaetere
 * Occlusion-Schicht dieselben Vorderseiten benutzt statt eigene Pixel.
 */
import { Graphics, type Container } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { edgeOnRim } from '../core/sim/layout-edges';
import type { LayoutEdge, LayoutState } from '../core/sim/layout-types';
import { INK, LIGHT, STROKE } from './art-tokens';
import { wallOwnerTile } from './floor-math';
import { addTiling } from './floor-surface';
import { floorArtFor, materialAt } from './floor-material';

export const WALL = 6;
/** Sichtbare Vorderseite: dieselbe Hoehe nutzt spaeter die Occlusion-Schicht. */
const WALL_FACE = 3;
const WALLPAPER = 'environment/tiles/wallpaper-damask-plum.png';

interface Rect { x: number; y: number; w: number; h: number }
interface WallView { readonly size: number; readonly layout: LayoutState }



/** Wandband liegt vollstaendig in der Besitzer-Kachel; Randkanten werden eingezogen. */
export function wallBandRect(edge: LayoutEdge, size: number, tile: number): Rect {
  if (edge.axis === 'H') {
    return { x: edge.x * tile, y: edge.y >= size ? edge.y * tile - WALL : edge.y * tile, w: tile, h: WALL };
  }
  return { x: edge.x >= size ? edge.x * tile - WALL : edge.x * tile, y: edge.y * tile, w: WALL, h: tile };
}

/** Vorderseite: Suedkante bei H, Ostkante bei V. Immer innerhalb des Bands. */
export function wallFaceRect(edge: LayoutEdge, size: number, tile: number): Rect {
  const band = wallBandRect(edge, size, tile);
  return edge.axis === 'H'
    ? { x: band.x + 1, y: band.y + band.h - WALL_FACE, w: Math.max(0, band.w - 2), h: WALL_FACE }
    : { x: band.x + band.w - WALL_FACE, y: band.y + 1, w: WALL_FACE, h: Math.max(0, band.h - 2) };
}

interface DoorParts {
  /** Schwelle: Boden laeuft durch, die Wand fehlt. */
  readonly threshold: Rect;
  /** Pfosten links/rechts der Tuer; ein Durchgang hat keine. */
  readonly posts: readonly Rect[];
}

export function doorParts(edge: LayoutEdge, size: number, tile: number): DoorParts {
  const band = wallBandRect(edge, size, tile);
  if (edge.kind === 'OPENING') return { threshold: band, posts: [] };
  const depth = Math.min(WALL, band.h);
  const width = Math.min(WALL, band.w);
  const posts = edge.axis === 'H'
    ? [{ x: band.x, y: band.y, w: width, h: depth }, { x: band.x + band.w - width, y: band.y, w: width, h: depth }]
    : [{ x: band.x, y: band.y, w: width, h: Math.min(WALL, band.h) }, { x: band.x, y: band.y + band.h - WALL, w: width, h: Math.min(WALL, band.h) }];
  return { threshold: band, posts };
}

/** Wandkoerper mit Lichtkante, Vorderseite und Fuss; Tueren bekommen eine Schwelle. */
function drawWall(g: Graphics, edge: LayoutEdge, view: WallView, tile: number, deco?: Container): void {
  const band = wallBandRect(edge, view.size, tile);
  const owner = wallOwnerTile(edge, view.size);
  const material = materialAt(view.layout, owner.x, owner.y);
  const art = material ? floorArtFor(material) : null;
  if (edge.kind === 'WALL') {
    g.rect(band.x, band.y, band.w, band.h).fill({ color: INK, alpha: 0.94 });
    addTiling(deco, WALLPAPER, band.x, band.y, band.w, band.h, 2, 0.24);
    g.rect(band.x + 0.5, band.y + 0.5, band.w - 1, band.h - 1).stroke({ width: STROKE.hair, color: 0x05030a, alpha: 0.85 });
    const face = wallFaceRect(edge, view.size, tile);
    g.rect(face.x, face.y, face.w, face.h).fill({ color: 0x191322, alpha: 0.95 });
    g.rect(face.x, face.y, face.w, 1).fill({ color: art?.light ?? LIGHT.cool, alpha: 0.26 });
    // Fuss: eine dunkle Linie auf dem Boden macht die Wand standfest.
    if (edge.axis === 'H') g.rect(band.x, band.y + band.h, band.w, 1).fill({ color: 0x000000, alpha: 0.34 });
    else g.rect(band.x + band.w, band.y, 1, band.h).fill({ color: 0x000000, alpha: 0.34 });
    // Ecken schliessen: zwei kurze Ueberlappungen statt einer Luecke an der Naht.
    g.rect(band.x, band.y, 2, 2).fill({ color: INK, alpha: 0.94 });
    g.rect(band.x + band.w - 2, band.y + band.h - 2, 2, 2).fill({ color: INK, alpha: 0.94 });
    return;
  }
  const parts = doorParts(edge, view.size, tile);
  const base = art?.base ?? INK;
  g.rect(parts.threshold.x, parts.threshold.y, parts.threshold.w, parts.threshold.h)
    .fill({ color: base, alpha: 0.96 });
  const accent = art?.accent ?? LIGHT.neon;
  if (edge.axis === 'H') {
    g.rect(parts.threshold.x, parts.threshold.y, parts.threshold.w, 1).fill({ color: accent, alpha: 0.22 });
    g.rect(parts.threshold.x, parts.threshold.y + parts.threshold.h - 1, parts.threshold.w, 1).fill({ color: 0x000000, alpha: 0.3 });
  } else {
    g.rect(parts.threshold.x, parts.threshold.y, 1, parts.threshold.h).fill({ color: accent, alpha: 0.22 });
    g.rect(parts.threshold.x + parts.threshold.w - 1, parts.threshold.y, 1, parts.threshold.h).fill({ color: 0x000000, alpha: 0.3 });
  }
  for (const post of parts.posts) g.rect(post.x, post.y, post.w, post.h).fill({ color: INK, alpha: 0.9 });
  // Nur die Haustuer leuchtet: der Eingang ist ein Ziel, keine Wand.
  if (edge.kind === 'DOOR' && edgeOnRim(edge, view.size)) {
    g.rect(band.x, band.y, band.w, band.h).fill({ color: LIGHT.neon, alpha: 0.16 });
    g.rect(band.x, band.y, band.w, 1).fill({ color: LIGHT.neon, alpha: 0.5 });
  }
}

/** Alle Kanten, deren Besitzer-Kachel in diesem Chunk liegt. */
function regionEdges(layout: LayoutState, area: Area): LayoutEdge[] {
  const x0 = Math.max(0, area.x);
  const y0 = Math.max(0, area.y);
  const x1 = Math.min(layout.size, area.x + area.w);
  const y1 = Math.min(layout.size, area.y + area.h);
  const edges: LayoutEdge[] = [];
  for (const edge of layout.edges) {
    const owner = wallOwnerTile(edge, layout.size);
    if (owner.x < x0 || owner.y < y0 || owner.x >= x1 || owner.y >= y1) continue;
    edges.push(edge);
  }
  return edges;
}

export function drawWalls(g: Graphics, view: WallView, area: Area, tile: number, deco?: Container): void {
  for (const edge of regionEdges(view.layout, area)) drawWall(g, edge, view, tile, deco);
}
