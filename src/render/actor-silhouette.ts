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

/** Zeichnet die Silhouette mit dem Fußpunkt bei (0, 0). */
export function drawActorSilhouette(g: Graphics, outfit: number, skin: number): void {
  const { width, head, body, leg } = SILHOUETTE;
  const left = -width / 2;
  // Kopf, Körper und zwei Beine: eine Person, kein Pin und kein Quadrat.
  g.circle(0, -14, head / 2).fill(skin).stroke({ width: 1, color: 0x0a0612, alpha: 0.8 });
  g.roundRect(left + 2, -10, width - 4, body, 2).fill(outfit);
  g.rect(left + 3, -3, 2.5, leg).fill(outfit);
  g.rect(width / 2 - 5.5, -3, 2.5, leg).fill(outfit);
  // Ein schmaler Kontraststreifen hält die Silhouette auch auf hellem Boden lesbar.
  g.rect(left + 2, -10, 1, body).fill({ color: 0x0a0612, alpha: 0.35 });
}
