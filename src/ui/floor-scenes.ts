/** Eine Regel fuer alle Floor-Eingaenge: Maus, Touch und Tastatur lesen dieselbe Szene. */
import type { GameView } from '../store/types';

export type FloorTargetKind = 'floor' | 'door' | 'guest' | 'furniture' | 'crate' | 'stain' | 'mop';

/** Der Fremd-Floor ist ein Menue, kein begehbarer Boden: kein WASD. */
export function floorMovementAllowed(scene: GameView['scene']['kind']): boolean {
  return scene !== 'FOREIGN';
}


/**
 * Boden und Tueren sind ueberall erreichbar, wo der Floor bedienbar ist.
 * Moebel, Gaeste und Kisten bleiben dem eigenen Casino vorbehalten: ihre
 * Commands arbeiten auf dessen Weltobjekten, nicht auf Wohnungs- oder
 * Stadtrequisiten.
 */
export function floorTapAllowed(
  scene: GameView['scene']['kind'],
  target: FloorTargetKind,
): boolean {
  if (scene === 'FOREIGN') return false;
  if (scene === 'OWN') return true;
  return target === 'floor' || target === 'door';
}
