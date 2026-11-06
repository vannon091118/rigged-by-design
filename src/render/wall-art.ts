/**
 * Türschwellen aus den gespeicherten Kanten. Wandkoerper liegen bewusst nicht
 * im Chunk, sondern als Occlusion-Sprites in der gemeinsamen Tiefenebene:
 * nur so koennen sie Figuren hinter sich verdecken, ohne Figuren davor zu
 * ueberdecken.
 *
 * Die reine Geometrie (Band, Vorderseite, Besitzregel) ist die gemeinsame
 * Wahrheit fuer beide Schichten.
 */
import { Graphics } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { edgeOnRim } from '../core/sim/layout-edges';
import type { LayoutEdge, LayoutState } from '../core/sim/layout-types';
import { INK, LIGHT } from './art-tokens';
import { wallOwnerTile } from './floor-math';
import { floorArtFor, materialAt } from './floor-material';

export const WALL = 6;
/** Sichtbare Vorderseite; dieselbe Hoehe nutzt die Occlusion-Schicht. */
export const WALL_FACE = 3;

interface Rect { x: number; y: number; w: number; h: number }
export interface WallView { readonly size: number; readonly layout: LayoutState }

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
  const posts = edge.axis === 'H'
    ? [{ x: band.x, y: band.y, w: WALL, h: WALL }, { x: band.x + band.w - WALL, y: band.y, w: WALL, h: WALL }]
    : [{ x: band.x, y: band.y, w: WALL, h: WALL }, { x: band.x, y: band.y + band.h - WALL, w: WALL, h: WALL }];
  return { threshold: band, posts };
}

/** Stabile Sortier-ID einer Wand: Achse, Anker, keine Zufallszahl. */
export const wallDepthId = (edge: LayoutEdge): number =>
  (edge.axis === 'V' ? 1_000_000 : 0) + edge.y * 1000 + edge.x;

function drawDoor(g: Graphics, edge: LayoutEdge, view: WallView, tile: number): void {
  const parts = doorParts(edge, view.size, tile);
  const owner = wallOwnerTile(edge, view.size);
  const material = materialAt(view.layout, owner.x, owner.y);
  const art = material ? floorArtFor(material) : null;
  const base = art?.base ?? INK;
  const accent = art?.accent ?? LIGHT.neon;
  const t = parts.threshold;
  g.rect(t.x, t.y, t.w, t.h).fill({ color: base, alpha: 0.96 });
  if (edge.axis === 'H') {
    g.rect(t.x, t.y, t.w, 1).fill({ color: accent, alpha: 0.22 });
    g.rect(t.x, t.y + t.h - 1, t.w, 1).fill({ color: 0x000000, alpha: 0.3 });
  } else {
    g.rect(t.x, t.y, 1, t.h).fill({ color: accent, alpha: 0.22 });
    g.rect(t.x + t.w - 1, t.y, 1, t.h).fill({ color: 0x000000, alpha: 0.3 });
  }
  for (const post of parts.posts) g.rect(post.x, post.y, post.w, post.h).fill({ color: INK, alpha: 0.9 });
  // Nur die Haustuer leuchtet: der Eingang ist ein Ziel, keine Wand.
  if (edge.kind === 'DOOR' && edgeOnRim(edge, view.size)) {
    g.rect(t.x, t.y, t.w, t.h).fill({ color: LIGHT.neon, alpha: 0.16 });
    g.rect(t.x, t.y, t.w, 1).fill({ color: LIGHT.neon, alpha: 0.5 });
  }
}

/** Schwellen aller Tueren und Durchgaenge, deren Besitzer-Kachel im Chunk liegt. */
export function drawDoors(g: Graphics, view: WallView, area: Area, tile: number): void {
  const x1 = Math.min(view.layout.size, area.x + area.w);
  const y1 = Math.min(view.layout.size, area.y + area.h);
  for (const edge of view.layout.edges) {
    if (edge.kind === 'WALL') continue;
    const owner = wallOwnerTile(edge, view.layout.size);
    if (owner.x < area.x || owner.y < area.y || owner.x >= x1 || owner.y >= y1) continue;
    drawDoor(g, edge, view, tile);
  }
}
