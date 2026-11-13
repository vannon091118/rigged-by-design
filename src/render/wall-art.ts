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
const WALL_FACE = 3;

interface Rect { x: number; y: number; w: number; h: number }
export interface WallView { readonly size: number; readonly layout: LayoutState }

/** Wandband liegt vollstaendig in der Besitzer-Kachel; Randkanten werden eingezogen. */
export function wallBandRect(edge: LayoutEdge, size: number, tile: number): Rect {
  if (edge.axis === 'H') {
    return { x: edge.x * tile, y: edge.y >= size ? edge.y * tile - WALL : edge.y * tile, w: tile, h: WALL };
  }
  return { x: edge.x >= size ? edge.x * tile - WALL : edge.x * tile, y: edge.y * tile, w: WALL, h: tile };
}

/** Vorderseite eines Bands: Suedkante bei H, Ostkante bei V. */
export function wallFaceInBand(axis: 'H' | 'V', band: Rect): Rect {
  return axis === 'H'
    ? { x: band.x + 1, y: band.y + band.h - WALL_FACE, w: Math.max(0, band.w - 2), h: WALL_FACE }
    : { x: band.x + band.w - WALL_FACE, y: band.y + 1, w: WALL_FACE, h: Math.max(0, band.h - 2) };
}

/** Vorderseite: Suedkante bei H, Ostkante bei V. Immer innerhalb des Bands. */
export function wallFaceRect(edge: LayoutEdge, size: number, tile: number): Rect {
  return wallFaceInBand(edge.axis, wallBandRect(edge, size, tile));
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

/**
 * Zwei schmale Kanten statt einer deckenden Flaeche: Der Boden laeuft durch
 * die Schwelle, die Wand fehlt. Ein Voll-Rect wuerde genau das verdecken.
 */
export function thresholdLines(edge: LayoutEdge, size: number, tile: number): readonly [Rect, Rect] {
  const band = wallBandRect(edge, size, tile);
  return edge.axis === 'H'
    ? [{ x: band.x, y: band.y, w: band.w, h: 1 }, { x: band.x, y: band.y + band.h - 1, w: band.w, h: 1 }]
    : [{ x: band.x, y: band.y, w: 1, h: band.h }, { x: band.x + band.w - 1, y: band.y, w: 1, h: band.h }];
}

/** Max. Layoutkante (LAYOUT_SIZES endet bei 90): 7 Bit je Achse. */
const WALL_COORD_BITS = 7;
/** 7 Bit y, 7 Bit x, 1 Achsenbit. */
export const WALL_ID_SPAN = 1 << 15;

/** Eindeutige Sortier-ID: Achse, Anker, keine Zufallszahl. */
export const wallDepthId = (edge: LayoutEdge): number =>
  (((edge.y << WALL_COORD_BITS) | edge.x) * 2) + (edge.axis === 'V' ? 1 : 0);

function drawDoor(g: Graphics, edge: LayoutEdge, view: WallView, tile: number): void {
  const parts = doorParts(edge, view.size, tile);
  const owner = wallOwnerTile(edge, view.size);
  const material = materialAt(view.layout, owner.x, owner.y);
  const art = material ? floorArtFor(material) : null;
  const accent = art?.accent ?? LIGHT.neon;
  const [accentLine, shadowLine] = thresholdLines(edge, view.size, tile);
  g.rect(accentLine.x, accentLine.y, accentLine.w, accentLine.h).fill({ color: accent, alpha: 0.22 });
  g.rect(shadowLine.x, shadowLine.y, shadowLine.w, shadowLine.h).fill({ color: 0x000000, alpha: 0.3 });
  for (const post of parts.posts) g.rect(post.x, post.y, post.w, post.h).fill({ color: INK, alpha: 0.9 });
  // Nur die Haustuer leuchtet: der Eingang ist ein Ziel, keine Wand.
  if (edge.kind === 'DOOR' && edgeOnRim(edge, view.size)) {
    g.rect(accentLine.x, accentLine.y, accentLine.w, accentLine.h).fill({ color: LIGHT.neon, alpha: 0.5 });
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
