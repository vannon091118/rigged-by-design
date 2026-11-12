/** Eine Regel fuer alle Floor-Eingaenge: Maus, Touch und Tastatur lesen dieselbe Szene. */
import type { GameView } from '../store/types';

export type FloorTargetKind = 'floor' | 'door' | 'guest' | 'furniture' | 'crate' | 'stain' | 'mop';

/**
 * Begehbar ist jeder Floor, auf dem die Figur steht. Eigentumsrechte regeln
 * Aktionen, nicht Bewegung: auch ein fremdes Casino teilt sich Kamera, WASD
 * und Boden-Taps mit dem eigenen Haus.
 */
export function floorMovementAllowed(scene: GameView['scene']['kind']): boolean {
  return scene !== undefined;
}

/**
 * Boden und Tueren sind ueberall erreichbar, wo der Floor bedienbar ist.
 * Moebel, Gaeste und Kisten bleiben dem eigenen Casino vorbehalten: ihre
 * Commands arbeiten auf dessen Weltobjekten, nicht auf Wohnungs-, Stadt- oder
 * fremden Requisiten. Der fremde Floor gibt deshalb nur den Boden frei.
 */
export function floorTapAllowed(
  scene: GameView['scene']['kind'],
  target: FloorTargetKind,
): boolean {
  if (scene === 'FOREIGN') return target === 'floor';
  if (scene === 'OWN') return true;
  if (scene === 'APARTMENT') return target === 'floor' || target === 'door' || target === 'furniture';
  return target === 'floor' || target === 'door';
}
