/** Floor-Input: ein Trefferpfad, baut Aktionen und ruft Callbacks. */
import type { Application, Container } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { buildStainActions, buildGuestActions, buildFurnitureActions, type MenuAction } from './floor-actions';
import { resolveHit, type ScreenAnchor } from './floor-hit';

export type { ScreenAnchor } from './floor-hit';

export interface FloorCallbacks {
  readonly onGuest: (id: number, anchor: ScreenAnchor | null) => void;
  readonly onFurniture: (id: number, anchor: ScreenAnchor | null) => void;
  readonly onEmpty: (x: number, y: number) => void;
  /** Aktionen landen in der Aktionskarte, nicht mehr in einem Radialmenue. */
  readonly onActions: (actions: MenuAction[], anchor: ScreenAnchor | null) => void;
}

export type TapHit =
  | { readonly kind: 'gesture'; readonly id: number }
  | { readonly kind: 'furniture'; readonly id: number }
  | { readonly kind: 'stain'; readonly id: number }
  | { readonly kind: 'empty'; readonly id: number };

export function handleTap(
  button: number,
  point: { x: number; y: number },
  view: GameView,
  cues: { ping: (p: { x: number; y: number }) => void },
  callbacks: FloorCallbacks,
  placing: boolean,
  lod: number,
  zoomToArea: (x: number, y: number) => void,
  anchor: ScreenAnchor | null = null,
): TapHit | null {
  if (button !== 0) return null;
  const x = Math.floor(point.x / TILE);
  const y = Math.floor(point.y / TILE);
  if (x < 0 || y < 0 || x >= view.size || y >= view.size) return null;
  cues.ping({ x, y });

  // Tiefe, Rang und Sichtlinie entscheiden hier, nicht die Reihenfolge im Snapshot.
  const hit = resolveHit(view, { x, y }, view.player.position);

  if (hit?.kind === 'stain') {
    const stain = view.stains.find((entry) => entry.id === hit.id);
    if (stain) {
      callbacks.onActions(buildStainActions(view, stain), anchor);
      return { kind: 'stain', id: stain.id };
    }
  }

  if (hit?.kind === 'furniture') {
    const item = view.furniture.find((entry) => entry.id === hit.id);
    if (item) {
      callbacks.onActions(buildFurnitureActions(view, item), anchor);
      callbacks.onFurniture(item.id, anchor);
      return { kind: 'furniture', id: item.id };
    }
  }

  if (hit?.kind === 'guest') {
    const guest = view.guests.find((entry) => entry.id === hit.id);
    if (guest) {
      callbacks.onActions(buildGuestActions(view, guest), anchor);
      callbacks.onGuest(guest.id, anchor);
      return { kind: 'gesture', id: guest.id };
    }
  }

  if (lod === 0 && !placing) { zoomToArea(x, y); return { kind: 'empty', id: 0 }; }
  callbacks.onEmpty(x, y);
  return { kind: 'empty', id: 0 };
}

/** Bildschirm-Pixel in Kamera-Koordinaten; Touch und Maus teilen sich diesen Pfad. */
export function screenPoint(
  clientX: number,
  clientY: number,
  app: Application,
  camera: Container,
): { x: number; y: number } | null {
  const rect = app.canvas.getBoundingClientRect();
  if (rect.width === 0) return null;
  const factor = rect.width / app.screen.width;
  return {
    x: ((clientX - rect.left) / factor - camera.x) / camera.scale.x,
    y: ((clientY - rect.top) / factor - camera.y) / camera.scale.y,
  };
}

/**
 * Die Gegenrichtung: Weltpunkt in Viewport-Pixel. Genau das braucht React, um
 * eine Karte an das getroffene Objekt zu haengen statt in eine Ecke.
 */
export function screenAnchorOf(point: { x: number; y: number }, app: Application, camera: Container): ScreenAnchor | null {
  const rect = app.canvas.getBoundingClientRect();
  if (rect.width === 0) return null;
  const factor = rect.width / app.screen.width;
  return {
    x: rect.left + (point.x * camera.scale.x + camera.x) * factor,
    y: rect.top + (point.y * camera.scale.y + camera.y) * factor,
    worldX: point.x,
    worldY: point.y,
  };
}
