/** Floor-Input: Tap-Logik, baut Aktionen und ruft Callbacks. */
import type { Application, Container } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { WorldState } from '../core/sim/types';
import { buildStainActions, buildGuestActions, buildFurnitureActions, type MenuAction } from './floor-actions';

export interface FloorCallbacks {
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
  /** Aktionen landen in der Aktionskarte, nicht mehr in einem Radialmenue. */
  readonly onActions: (actions: MenuAction[]) => void;
}

export type TapHit =
  | { readonly kind: 'gesture'; readonly id: number }
  | { readonly kind: 'furniture'; readonly id: number }
  | { readonly kind: 'stain'; readonly id: number }
  | { readonly kind: 'empty'; readonly id: number };

export function handleTap(
  button: number,
  point: { x: number; y: number },
  view: WorldState,
  cues: { ping: (p: { x: number; y: number }) => void },
  callbacks: FloorCallbacks,
  placing: boolean,
  lod: number,
  zoomToArea: (x: number, y: number) => void,
): TapHit | null {
  if (button !== 0) return null;
  const x = Math.floor(point.x / TILE);
  const y = Math.floor(point.y / TILE);
  if (x < 0 || y < 0 || x >= view.size || y >= view.size) return null;
  cues.ping({ x, y });

  const stain = view.stains.find((s) => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
  if (stain) {
    callbacks.onActions(buildStainActions(view, stain));
    return { kind: 'stain', id: stain.id };
  }

  const furniture = view.furniture.find((item) =>
    x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
  if (furniture) {
    callbacks.onActions(buildFurnitureActions(view, furniture));
    callbacks.onFurniture(furniture.id);
    return { kind: 'furniture', id: furniture.id };
  }

  const guest = view.guests
    .map((entry) => ({ entry, distance: Math.abs(entry.position.x - x) + Math.abs(entry.position.y - y) }))
    .filter((entry) => entry.distance <= 1)
    .sort((a, b) => a.distance - b.distance)[0];
  if (guest) {
    callbacks.onActions(buildGuestActions(view, guest.entry));
    callbacks.onGuest(guest.entry.id);
    return { kind: 'gesture', id: guest.entry.id };
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
