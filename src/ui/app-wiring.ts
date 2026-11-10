/** App-Verdrahtung: Navigation, Floor-Aktionen und Kisten ohne eigenen Zustand. */
import type { BuildId } from '../core/sim/offers';
import type { MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import { handleFloorInteract } from '../render/floor-interact';
import type { GameView } from '../store/types';
import type { Perspective, Popup } from './app-model';

interface AppSetters {
  readonly setPopup: (popup: Popup) => void;
  readonly setPopupAnchor: (anchor: ScreenAnchor | null) => void;
  readonly setBuildOpen: (open: boolean) => void;
  readonly setPerspective: (next: Perspective) => void;
}

/** Ein Popup loest den Bau-Schalter und den alten Anker: sonst bleibt ein Geist stehen. */
export function openPopupWith(setters: AppSetters, next: Popup): void {
  setters.setBuildOpen(false);
  setters.setPopupAnchor(null);
  setters.setPopup(next);
}

/** Perspektivwechsel raeumt jede offene Ebene ab, bevor der Leser wechselt. */
export function switchPerspective(setters: AppSetters, current: Perspective, next: Perspective): void {
  if (next === current) return;
  setters.setPopup(null);
  setters.setPopupAnchor(null);
  setters.setBuildOpen(false);
  setters.setPerspective(next);
}

/** Ein Pfad fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln. */
export function makeActionExecutor(
  open: (popup: Popup) => void,
  anchorAt: (anchor: ScreenAnchor | null) => void,
): (action: MenuAction, at: ScreenAnchor | null) => void {
  return (action, at) => {
    if (action.id === 'OPEN_MACHINE' && action.targetId !== undefined) {
      open({ kind: 'machine', itemId: action.targetId });
      anchorAt(at);
      return;
    }
    if (action.id === 'OPEN_GUEST' && action.targetId !== undefined) {
      open({ kind: 'guests', guestId: action.targetId });
      return;
    }
    if (action.id === 'SPIEGEL') { open({ kind: 'look' }); return; }
    handleFloorInteract(action.id, action.targetId);
  };
}

export function isCarryingCrate(carrying: string): boolean {
  return carrying.startsWith('KRATE:');
}

/** Der Geist zeigt nur Moebel; andere Kisten haben kein Platzierbild. */
export function crateGhostId(carrying: string, crates: GameView['crates']): BuildId | null {
  const match = /^KRATE:(\d+)$/.exec(carrying);
  const crate = match ? crates.find((entry) => entry.id === Number(match[1])) : undefined;
  return crate && crate.payload.kind === 'FURNITURE' ? crate.payload.buildId : null;
}

/** Editor aus der URL nehmen, damit ein Reload ihn nicht wieder oeffnet. */
export function closeEditorUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('editor');
  window.history.replaceState(null, '', url);
}
