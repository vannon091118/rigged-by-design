/**
 * Akteur-Silhouette für das Übersichts-LOD.
 *
 * Bewusst eine eigene, kleine Zeichnung statt des 6×6-Pins: Die Figur bleibt
 * als Person lesbar, wenn der Detail-Rig ausgeblendet ist. Die Maße sind
 * stabil und werden von Tests und Renderer gemeinsam gelesen.
 */
import type { Graphics } from 'pixi.js';

export const SILHOUETTE = Object.freeze({ width: 12, height: 16, head: 6, body: 6, leg: 4 });

export const SILHOUETTE_PERSONAS = Object.freeze(['LUMPEN', 'STREET', 'BUSINESS', 'HIGH_ROLLER', 'STAMMGAST'] as const);

/** Kopfform im LOD; sie bleibt aus der Ferne erkennbar, ohne den Rig zu zeichnen. */
export const SILHOUETTE_HEADS = Object.freeze(['round', 'bob', 'cap'] as const);
export type SilhouetteHead = (typeof SILHOUETTE_HEADS)[number];

export interface SilhouetteLook {
  readonly outfit: number;
  readonly skin: number;
  readonly hair: number;
  readonly head: SilhouetteHead;
}

/**
 * Bildschirmmaßstab der Fernsilhouette.
 *
 * Die Kamera zoomt, die Übersicht nicht: Bei LOD 0 wird die Weltkopie mit
 * `1 / cameraScale` gezeichnet, damit die 12 × 16-Silhouette bei 1× und 2×
 * dieselbe Fläche auf dem Bildschirm einnimmt und Kopfform wie Haarton
 * lesbar bleiben. Im Detail-LOD gilt wieder der Weltmaßstab 1.
 */
export function silhouettePinScale(detail: boolean, cameraScale: number): number {
  if (detail) return 1;
  const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1;
  return 1 / scale;
}

/** Kopffamilie -> Fernform: head-02 traegt Kappe, head-03 den Bob. */
export function silhouetteHeadFor(family: string | null): SilhouetteHead {
  if (family === 'head-02') return 'cap';
  if (family === 'head-03') return 'bob';
  return 'round';
}

/**
 * Haarton fuer das LOD: relative Helligkeit bleibt, dunkle Toene werden so
 * weit angehoben, dass sie auf dem dunklen Boden nicht zu einem Loch werden.
 */
function lodHair(color: number, extra = 0): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const amount = (luminance < 90 ? 0.35 : luminance < 140 ? 0.22 : 0.08) + extra;
  const lift = (channel: number): number => Math.round(channel + (255 - channel) * amount);
  return (lift(r) << 16) | (lift(g) << 8) | lift(b);
}

const OUTLINE = 0x0a0612;

/** Zeichnet die Silhouette mit dem Fußpunkt bei (0, 0), Umriss bleibt 12 × 16. */
export function drawActorSilhouette(g: Graphics, look: SilhouetteLook): void {
  const { width, body } = SILHOUETTE;
  const half = width / 2;
  const hair = lodHair(look.hair);
  const rim = lodHair(look.hair, 0.35);
  // Kopf 6 × 6: darin bleiben Platz fuer zwei Haarton-Reihen und ein Gesicht.
  g.roundRect(-3, -16, 6, 6, 2).fill(look.skin);
  // Jede Familie hat eine eigene Kontur: Krone, lange Seiten oder breiter Schirm.
  g.rect(-3, -16, 6, 1).fill(rim);
  g.rect(-3, -15, 6, 2).fill(hair);
  if (look.head === 'cap') {
    g.rect(-5, -13, 10, 1).fill(hair);
    g.rect(-5, -13, 1, 1).fill(rim);
    g.rect(4, -13, 1, 1).fill(rim);
  } else if (look.head === 'bob') {
    g.rect(-5, -14, 2, 4).fill(hair);
    g.rect(3, -14, 2, 4).fill(hair);
    g.rect(-5, -14, 1, 4).fill(rim);
    g.rect(4, -14, 1, 4).fill(rim);
  }
  g.roundRect(-half + 2, -10, width - 4, body, 2).fill(look.outfit);
  g.rect(-half + 3, -4, 2, 4).fill(look.outfit);
  g.rect(half - 5, -4, 2, 4).fill(look.outfit);
  // Ein schmaler Kontraststreifen hält die Silhouette auch auf hellem Boden lesbar.
  g.rect(-half + 2, -10, 1, body).fill({ color: OUTLINE, alpha: 0.35 });
}
