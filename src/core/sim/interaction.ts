/**
 * Interaktionsradius-System für Charakter-Steuerung.
 * Headless, deterministisch, keine Browser-Abhängigkeiten.
 * Alle Abstände sind Manhattan-Distanz (Kachel-basiert), konsistent mit
 * dem bestehenden Codebase (z. B. unloadHereCmd, pickupCrate, serveDesk).
 */

import type { Point } from './types-model';

/**
 * Manhattan-Abstand zwischen zwei Punkten.
 * Entspricht der bestehenden Berechnung im Codebase
 * (Math.abs(x1 - x2) + Math.abs(y1 - y2)).
 */
export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Prüft, ob `from` innerhalb `radius` von `to` liegt.
 */
export function isInRange(from: Point, to: Point, radius: number): boolean {
  return manhattanDistance(from, to) <= radius;
}

/**
 * Interaktionsradien pro Objekttyp (in Tiles/Kacheln).
 * Generisch — keine Hardcodierung spezifischer Floors oder Toiletten.
 * Die Floors werden bald überarbeitet; dieses System bleibt stabil.
 */
export const INTERACTION_RADII: Readonly<Record<string, number>> = {
  STAIN: 1,
  MOP: 1,
  GUEST: 1,
  TOILET: 2,
  BAR: 3,
  STORAGE: 3,
  EXCHANGE: 4,
  CRATE: 2,
  FURNITURE: 2,
  DESK: 4,
} as const;

/**
 * Gibt den Interaktionsradius für einen Objekttyp zurück.
 * Berücksichtigt zuerst den spezifischen Typ des Möbelstücks,
 * dann den generischen Kind, fällt auf FURNITURE (2) zurück.
 */
export function interactionRadiusFor(
  kind: string,
  furniture?: { kind?: string } | null
): number {
  if (furniture?.kind) {
    const specific = INTERACTION_RADII[furniture.kind];
    if (specific !== undefined) return specific;
  }
  const generic = INTERACTION_RADII[kind];
  if (generic !== undefined) return generic;
  return INTERACTION_RADII.FURNITURE;
}
