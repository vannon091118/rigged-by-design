/** Ein Fokus fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InteractionTarget } from '../core/sim/interaction';
import type { MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import type { FloorTap } from '../render/floor-input';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { floorMovementAllowed } from './floor-scenes';
import { applyFloorTap } from './floor-tap';
import { useFloorKeyboard } from './use-floor-keyboard';
import { useFloorSelectionLifecycle } from './use-floor-selection-lifecycle';

export interface FloorSelection {
  readonly target: FloorTap['target'];
  readonly actions: readonly MenuAction[];
  readonly anchor: ScreenAnchor | null;
  readonly status: string;
  /** Ziel nicht erreichbar: die Karte bleibt sichtbar, die Aktionen sind gesperrt. */
  readonly blocked: boolean;
}

interface Options {
  readonly view: GameView;
  readonly enabled: boolean;
  readonly blocked: boolean;
  readonly onExecute: (action: MenuAction, anchor: ScreenAnchor | null) => void;
}

interface Pending {
  readonly action: MenuAction;
  readonly target: InteractionTarget;
}

export function useFloorInteraction(options: Options) {
  const [selection, setSelection] = useState<FloorSelection | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const selectionRef = useRef<FloorSelection | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  selectionRef.current = selection;

  /** Abbruch: Karte weg, Auftrag weg, Figur bleibt stehen. */
  const close = useCallback((): boolean => {
    if (!selectionRef.current && !pendingRef.current) return false;
    selectionRef.current = null;
    pendingRef.current = null;
    setSelection(null);
    worldStore.interaction.cancel();
    return true;
  }, []);

  useFloorSelectionLifecycle({
    scene: options.view.scene,
    selection: selectionRef,
    pathIndex: options.view.player.pathIndex,
    pathLength: options.view.player.path.length,
    setSelection,
    close,
  });

  const tap = useCallback((resolution: FloorTap): void => {
    if (latest.current.blocked) return;
    pendingRef.current = null;
    const apply = (next: FloorSelection | null): void => {
      selectionRef.current = next;
      setSelection(next);
    };
    // Dieselbe Szenenregel wie fuer WASD/E; direkte Ziele werden hier
    // abgeschlossen, numerische Casino-Ziele gehen in den Approach.
    if (applyFloorTap(latest.current.view.scene.kind, resolution, apply,
      (action, anchor) => latest.current.onExecute(action, anchor))) return;
    if (resolution.target.kind === 'door' || resolution.target.kind === 'cityActor'
      || resolution.target.kind === 'floor') return;
    const plan = worldStore.interaction.approach(resolution.target);
    if (!latest.current.enabled) {
      apply(null);
      return;
    }
    apply({
      target: resolution.target,
      actions: resolution.actions,
      anchor: resolution.anchor,
      status: plan.reachable ? (plan.inRange ? '' : 'Läuft hin …') : plan.reason,
      blocked: !plan.reachable,
    });
  }, []);

  const pick = useCallback((action: MenuAction): void => {
    if (!action.enabled) {
      if (action.reason) worldStore.interaction.notify(action.reason);
      return;
    }
    const anchor = selectionRef.current?.anchor ?? null;
    // Stadtfiguren laufen nicht ueber die Casino-Interaction; die Aktion
    // oeffnet die vorhandene Begegnung direkt.
    if (action.id === 'CITY_MEET') {
      latest.current.onExecute(action, anchor);
      setSelection(null);
      return;
    }
    // Queue-Auftraege naehern sich selbst; ein zweiter Approach wuerde den Pfad ueberschreiben.
    if (action.queued || action.id === 'MOVE_HERE') {
      latest.current.onExecute(action, anchor);
      setSelection(null);
      return;
    }
    if (action.target) {
      const plan = worldStore.interaction.approach(action.target);
      if (!plan.reachable) {
        setSelection((current) => current
          ? { ...current, status: plan.reason, blocked: true }
          : current);
        return;
      }
      if (!plan.inRange) {
        // Erst wenn die Reichweite wirklich erreicht ist, laeuft die Aktion.
        pendingRef.current = { action, target: action.target };
        setSelection((current) => current ? { ...current, status: 'Läuft hin …' } : current);
        return;
      }
    }
    latest.current.onExecute(action, anchor);
    setSelection(null);
  }, []);

  // Der eingereihte Auftrag laeuft genau einmal, sobald die Figur am Standplatz steht.
  useEffect(() => {
    const queued = pendingRef.current;
    if (!queued) return;
    if (!worldStore.interaction.inRange(queued.target)) {
      if (options.view.player.path.length === 0) {
        pendingRef.current = null;
        setSelection((current) => current
          ? { ...current, status: 'Ziel nicht erreichbar – Aktion abgebrochen.', blocked: true }
          : current);
      }
      return;
    }
    pendingRef.current = null;
    latest.current.onExecute(queued.action, selectionRef.current?.anchor ?? null);
    setSelection(null);
  }, [options.view.player.position.x, options.view.player.position.y, options.view.player.pathIndex, options.view.player.path.length]);

  // Tastatur: derselbe Fokus wie Maus und Touch, aber ohne eigenen Zustand.
  // Der fremde Floor hat noch keine eigenen Gast-/Moebel-Commands; Maus und
  // Touch sperren dieselben Ziele, E bleibt deshalb dort ebenfalls still.
  useFloorKeyboard({
    view: options.view,
    enabled: options.enabled && floorMovementAllowed(options.view.scene.kind)
      && options.view.scene.kind !== 'FOREIGN',
    blocked: options.blocked,
    selection,
    tap,
    pick,
  });

  return { selection, tap, pick, close };
}
