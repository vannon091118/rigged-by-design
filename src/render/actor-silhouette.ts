/**
 * Akteur-Silhouette für das Übersichts-LOD.
 *
 * Bewusst eine eigene, kleine Zeichnung statt des 6×6-Pins: Die Figur bleibt
 * als Person lesbar, wenn der Detail-Rig ausgeblendet ist. Die Maße sind
 * stabil und werden von Tests und Renderer gemeinsam gelesen.
 */
import type { Graphics } from 'pixi.js';

export const SILHOUETTE = Object.freeze({ width: 12, height: 16, head: 4, body: 6, leg: 3 });

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

/** Kopffamilie -> Fernform: head-02 traegt Kappe, head-03 den Bob. */
export function silhouetteHeadFor(family: string | null): SilhouetteHead {
  if (family === 'head-02') return 'cap';
  if (family === 'head-03') return 'bob';
  return 'round';
}

/** Zeichnet die Silhouette mit dem Fußpunkt bei (0, 0), Umriss bleibt 12 × 16. */
export function drawActorSilhouette(g: Graphics, look: SilhouetteLook): void {
  const { width, head, body, leg } = SILHOUETTE;
  const left = -width / 2;
  // Kopf, Körper und zwei Beine: eine Person, kein Pin und kein Quadrat.
  g.circle(0, -14, head / 2).fill(look.skin).stroke({ width: 1, color: 0x0a0612, alpha: 0.8 });
  // Haarton und Kopfform tragen die Identitaet auch ohne Detail-Rig.
  if (look.head === 'cap') {
    g.rect(-4, -16, 8, 2).fill(look.hair);
    g.rect(-5.5, -14.5, 11, 1).fill(look.hair);
  } else if (look.head === 'bob') {
    g.rect(-3, -16, 6, 1.5).fill(look.hair);
    g.rect(-4, -15, 1.5, 5).fill(look.hair);
    g.rect(2.5, -15, 1.5, 5).fill(look.hair);
  } else {
    g.rect(-3, -16, 6, 1.5).fill(look.hair);
  }
  g.roundRect(left + 2, -10, width - 4, body, 2).fill(look.outfit);
  g.rect(left + 3, -3, 2.5, leg).fill(look.outfit);
  g.rect(width / 2 - 5.5, -3, 2.5, leg).fill(look.outfit);
  // Ein schmaler Kontraststreifen hält die Silhouette auch auf hellem Boden lesbar.
  g.rect(left + 2, -10, 1, body).fill({ color: 0x0a0612, alpha: 0.35 });
}
