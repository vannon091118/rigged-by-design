/** Floor-Input: ein Trefferpfad, eine Aktionsliste, ein Ergebnis. Kein zweiter Klickpfad. */
import type { Application, Container } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { InteractionTarget } from '../core/sim/interaction';
import type { GameView } from '../store/types';
import { buildActions, type MenuAction } from './floor-actions';
import { resolveHit, type ScreenAnchor } from './floor-hit';

export type { ScreenAnchor } from './floor-hit';

type FloorTarget = InteractionTarget | { readonly kind: 'floor'; readonly x: number; readonly y: number };

interface TapResolution {
  readonly target: FloorTarget;
  readonly actions: readonly MenuAction[];
  /** Fussanker des Ziels in Weltpixeln; nicht die geklickte Pixelposition. */
  readonly at: { readonly x: number; readonly y: number };
}

export interface FloorTap extends TapResolution {
  readonly anchor: ScreenAnchor | null;
}

export interface FloorCallbacks {
  readonly onTap: (tap: FloorTap) => void;
}

/**
 * Ein Linksklick oder Tipp wird genau einmal ausgewertet. Die Zoomstufe
 * entscheidet nichts: ein leerer Boden ist immer ein Laufziel, nie ein
 * impliziter Zoom. Die Kamera hat dafuer Raeder, Pinch und Tasten.
 */
export function handleTap(
  button: number,
  point: { readonly x: number; readonly y: number },
  view: GameView,
  cues: { readonly ping: (cell: { readonly x: number; readonly y: number }) => void },
): TapResolution | null {
  if (button !== 0) return null;
  const x = Math.floor(point.x / TILE);
  const y = Math.floor(point.y / TILE);
  if (x < 0 || y < 0 || x >= view.size || y >= view.size) return null;
  cues.ping({ x, y });

  const hit = resolveHit(view, { x, y }, view.player.position);
  if (!hit) {
    return {
      target: { kind: 'floor', x, y },
      actions: [],
      at: { x: (x + 0.5) * TILE, y: (y + 1) * TILE },
    };
  }
  const focus: InteractionTarget = { kind: hit.kind, id: hit.id };
  return {
    target: focus,
    actions: buildActions(view, focus),
    at: { x: hit.at.x * TILE, y: hit.at.y * TILE },
  };
}

/** Ab hier ist ein zweiter Klick auf dasselbe Ziel ein Doppelklick, kein zweiter Auftrag. */
const TAP_WINDOW_MS = 320;

export interface TapMark {
  readonly key: string;
  readonly at: number;
}

export function tapKey(target: FloorTarget): string {
  return target.kind === 'floor' ? `floor:${target.x}:${target.y}` : `${target.kind}:${target.id}`;
}

export function acceptTap(previous: TapMark | null, key: string, now: number, window = TAP_WINDOW_MS): boolean {
  return !previous || previous.key !== key || now - previous.at >= window;
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
export function screenAnchorOf(point: { readonly x: number; readonly y: number }, app: Application, camera: Container): ScreenAnchor | null {
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
