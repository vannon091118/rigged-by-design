/** Tastenpfad der Buehne: laufen, tragen, zoomen. App verdrahtet nur noch. */
import { useEffect, useRef } from 'react';
import { worldStore } from '../store/use-world-store';
import { MOVE_KEYS } from './app-model';

interface StageKeyOptions {
  /** Solange ein Fenster offen ist, gehoeren die Tasten dem Fenster. */
  readonly enabled: boolean;
  readonly zoom: (factor: number) => void;
  readonly fit: () => void;
  /** Escape schliesst das Bau-Panel; Fenster regeln ihren eigenen Escape. */
  readonly onEscape?: () => void;
}

export function useStageKeys(options: StageKeyOptions): void {
  // Ein Ref statt Deps: die Handler-Identitaet wechselt bei jedem Snapshot.
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { latest.current.onEscape?.(); return; }
      if (!latest.current.enabled) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const direction = MOVE_KEYS[event.key.toLowerCase()];
      if (direction) {
        event.preventDefault();
        worldStore.moveStep(direction[0], direction[1]);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        worldStore.useCarriedHere();
        return;
      }
      if (event.key === '+' || event.key === '=' || event.key === '-') {
        event.preventDefault();
        latest.current.zoom(event.key === '-' ? 0.82 : 1.22);
        return;
      }
      if (event.key === '0') { event.preventDefault(); latest.current.fit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
