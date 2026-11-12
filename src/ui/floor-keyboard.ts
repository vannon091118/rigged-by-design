/** Tastaturpfad des Floors: E waehlt das naechste Ziel oder die Hauptaktion. */
import { buildActions, type MenuAction } from '../render/floor-actions';
import type { FloorTap } from '../render/floor-input';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { FloorSelection } from './use-floor-interaction';

export interface FloorKeyboardState {
  readonly view: GameView;
  readonly enabled: boolean;
  readonly blocked: boolean;
  readonly selection: FloorSelection | null;
  readonly tap: (resolution: FloorTap) => void;
  readonly pick: (action: MenuAction) => void;
}

/**
 * Ein Tastendruck, ein Ergebnis. Die Funktion ist frei von React, damit der
 * Schluesselpfad ohne DOM-Hook geprueft werden kann; der Hook darueber bindet
 * nur `keydown` und den jeweils letzten Zustand.
 */
export function handleFloorKey(event: KeyboardEvent, state: FloorKeyboardState): void {
  if (event.repeat || event.key.toLowerCase() !== 'e') return;
  if (!state.enabled || state.blocked) return;
  const element = event.target as HTMLElement | null;
  if (element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA'
    || element?.tagName === 'SELECT' || element?.isContentEditable) return;
  event.preventDefault();
  const current = state.selection;
  if (current) {
    const main = current.actions.find((action) => action.enabled) ?? current.actions[0];
    if (!main) return;
    if (!main.enabled) {
      worldStore.interaction.notify(main.reason ?? 'Aktion nicht möglich.');
      return;
    }
    state.pick(main);
    return;
  }
  const focus = worldStore.interaction.nearest(4);
  if (!focus) {
    worldStore.interaction.notify('Kein Ziel in Reichweite. Geh näher heran.');
    return;
  }
  state.tap({
    target: focus,
    actions: buildActions(state.view, focus),
    at: { x: 0, y: 0 },
    anchor: null,
  });
}
