/** Interaktionsradius-System für Charakter-Steuerung. Headless, deterministisch. */
import type { Point } from './types-model';

export function isInRange(from: Point, to: Point, radius: number): boolean {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= radius;
}

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
