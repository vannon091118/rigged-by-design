/**
 * Charakter-Entität und Interaktions-Logik.
 * Headless, deterministisch, keine Browser-Abhängigkeiten.
 * Baut auf dem existierenden Player (WorldState.player) und movePlayer auf.
 */

import type { Point } from './types-model';
import type { WorldState } from './types';
import { isInRange, interactionRadiusFor } from './interaction';

export interface CharacterAction {
  readonly kind: 'MOVE_TO' | 'INTERACT' | 'PICKUP' | 'USE';
  readonly targetId: number | null;
  readonly targetX: number | null;
  readonly targetY: number | null;
  readonly radius: number;
}

/**
 * Prüft, ob der Spieler im Interaktionsradius eines Ziels steht.
 * @param world Weltzustand (enthält world.player.position)
 * @param targetPos Position des Ziels
 * @param targetKind Objekttyp (z. B. 'STAIN', 'TOILET', 'BAR', 'GUEST', 'DESK')
 * @param targetFurniture optionales Möbelstück für typ-spezifischen Radius
 * @returns true, wenn der Spieler nah genug ist
 */
export function canInteract(
  world: WorldState,
  targetPos: Point,
  targetKind: string,
  targetFurniture?: { kind?: string } | null
): boolean {
  const radius = interactionRadiusFor(targetKind, targetFurniture);
  return isInRange(world.player.position, targetPos, radius);
}

/**
 * Setzt ein Bewegungsziel für den Spieler (einzelner Pfadschritt).
 * Der eigentliche Pfadfinder (findPath, movePlayer) wird im Tick
 * oder durch moveToCmd aufgerufen und wertet world.player.path aus.
 */
export function startMoveTo(world: WorldState, targetX: number, targetY: number): void {
  world.player.path = [{ x: targetX, y: targetY }];
  world.player.pathIndex = 0;
}

/**
 * Gibt den Interaktionsradius für einen Objekttyp zurück.
 */
export function getInteractionRadius(
  kind: string,
  furniture?: { kind?: string } | null
): number {
  return interactionRadiusFor(kind, furniture);
}

/**
 * Prüft, ob der Spieler etwas trägt (nicht-leerer carrying-String).
 */
export function isCarrying(world: WorldState): boolean {
  return world.player.carrying !== '';
}

/**
 * Gibt zurück, was der Spieler trägt (oder '' wenn nichts).
 */
export function getCarriedItem(world: WorldState): string {
  return world.player.carrying;
}
