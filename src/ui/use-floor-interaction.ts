/** Ein Fokus fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InteractionTarget } from '../core/sim/interaction';
import { buildActions, type MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import type { FloorTap } from '../render/floor-input';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';

interface FloorSelection {
  readonly target: InteractionTarget;
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

  const tap = useCallback((resolution: FloorTap): void => {
    if (latest.current.blocked) return;
    pendingRef.current = null;
    if (resolution.target.kind === 'floor') {
      setSelection(null);
      worldStore.moveTo({ x: resolution.target.x, y: resolution.target.y });
      return;
    }
    const plan = worldStore.interaction.approach(resolution.target);
    if (!latest.current.enabled) {
      setSelection(null);
      return;
    }
    const next: FloorSelection = {
      target: resolution.target,
      actions: resolution.actions,
      anchor: resolution.anchor,
      status: plan.reachable ? (plan.inRange ? '' : 'Läuft hin …') : plan.reason,
      blocked: !plan.reachable,
    };
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const pick = useCallback((action: MenuAction): void => {
    if (!action.enabled) {
      if (action.reason) worldStore.interaction.notify(action.reason);
      return;
    }
    const anchor = selectionRef.current?.anchor ?? null;
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

  // Angekommen: der Hinweis verschwindet, die Aktionen bleiben waehlbar.
  useEffect(() => {
    if (options.view.player.pathIndex < options.view.player.path.length) return;
    setSelection((current) => current?.status === 'Läuft hin …'
      ? { ...current, status: '' }
      : current);
  }, [options.view.player.pathIndex, options.view.player.path.length]);

  // Tastatur: E waehlt das naechste Ziel oder fuehrt die Hauptaktion des Fokus aus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || event.key.toLowerCase() !== 'e') return;
      if (!latest.current.enabled || latest.current.blocked) return;
      const element = event.target as HTMLElement | null;
      if (element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA'
        || element?.tagName === 'SELECT' || element?.isContentEditable) return;
      event.preventDefault();
      const current = selectionRef.current;
      if (current) {
        const main = current.actions.find((action) => action.enabled) ?? current.actions[0];
        if (!main) return;
        if (!main.enabled) {
          worldStore.interaction.notify(main.reason ?? 'Aktion nicht möglich.');
          return;
        }
        pick(main);
        return;
      }
      const focus = worldStore.interaction.nearest(4);
      if (!focus) {
        worldStore.interaction.notify('Kein Ziel in Reichweite. Geh näher heran.');
        return;
      }
      tap({
        target: focus,
        actions: buildActions(latest.current.view, focus),
        at: { x: 0, y: 0 },
        anchor: null,
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, tap]);

  return { selection, tap, pick, close };
}
