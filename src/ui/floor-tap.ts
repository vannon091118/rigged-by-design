/** Reine Tap-Aufloesung fuer Boden, Tueren und Stadtfiguren. */
import type { FloorTap } from '../render/floor-input';
import type { GameView } from '../store/types';
import { floorTapAllowed } from './floor-scenes';
import type { FloorSelection } from './use-floor-interaction';

type Apply = (next: FloorSelection | null) => void;
type Execute = (action: FloorTap['actions'][number], anchor: FloorTap['anchor']) => void;

/** Die Stadtfigur bleibt sichtbar, ihre Hauptaktion traegt den Sperrgrund. */
export function cityActorSelection(resolution: FloorTap): FloorSelection {
  const action = resolution.actions[0];
  const blocked = !action?.enabled;
  return {
    target: resolution.target,
    actions: resolution.actions,
    anchor: resolution.anchor,
    status: blocked ? (action?.reason ?? 'Geh näher heran.') : '',
    blocked,
  };
}

/**
 * Behandelt alle Ziele, die direkt eine Auswahl oder Aktion ausloesen.
 * `false` bedeutet: numerisches Casino-Ziel, der Aufrufer muss noch approachn.
 */
export function applyFloorTap(
  scene: GameView['scene']['kind'],
  resolution: FloorTap,
  apply: Apply,
  execute: Execute,
): boolean {
  if (!floorTapAllowed(scene, resolution.target.kind)) return true;
  if (resolution.target.kind === 'door') {
    const action = resolution.actions.find((entry) => entry.enabled);
    if (action) {
      apply(null);
      execute(action, resolution.anchor);
      return true;
    }
    apply({
      target: resolution.target,
      actions: resolution.actions,
      anchor: resolution.anchor,
      status: resolution.actions[0]?.reason ?? 'Kein Zugang.',
      blocked: true,
    });
    return true;
  }
  if (resolution.target.kind === 'cityActor') {
    apply(cityActorSelection(resolution));
    return true;
  }
  // Fremde Moebel und Gaeste gehoeren diesem Floor: ihre Karte zeigt sofort
  // den Platzstatus. Ein Approach auf eigene Casino-Objekte waere falsch.
  if (scene === 'FOREIGN' && (resolution.target.kind === 'furniture' || resolution.target.kind === 'guest')) {
    const action = resolution.actions[0];
    const blocked = !action?.enabled;
    apply({
      target: resolution.target,
      actions: resolution.actions,
      anchor: resolution.anchor,
      status: blocked ? (action?.reason ?? 'Hier ist nichts zu tun.') : '',
      blocked,
    });
    return true;
  }
  if (resolution.target.kind === 'floor') {
    apply({
      target: resolution.target,
      actions: resolution.actions,
      anchor: resolution.anchor,
      status: '',
      blocked: false,
    });
    return true;
  }
  return false;
}
