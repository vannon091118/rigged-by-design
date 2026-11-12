/** Bindet den reinen Floor-Tastenpfad an das Fenster; kein zweiter Listener je Szene. */
import { useEffect, useRef } from 'react';
import { handleFloorKey, type FloorKeyboardState } from './floor-keyboard';

export function useFloorKeyboard(state: FloorKeyboardState): void {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => handleFloorKey(event, latest.current);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
