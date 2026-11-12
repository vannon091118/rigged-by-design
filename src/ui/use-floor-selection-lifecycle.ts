/** Fokus-Lebenszyklus des Floors: Szene, Zielart und Ankunft raeumen dieselbe Auswahl. */
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { GameView } from '../store/types';
import { floorTapAllowed } from './floor-scenes';
import type { FloorSelection } from './use-floor-interaction';

interface SelectionLifecycle {
  readonly scene: GameView['scene'];
  readonly selection: { current: FloorSelection | null };
  readonly pathIndex: number;
  readonly pathLength: number;
  readonly setSelection: Dispatch<SetStateAction<FloorSelection | null>>;
  readonly close: () => boolean;
}

/**
 * Ein Szenenwechsel raeumt jeden Fokus: dieselbe Kachel bedeutet auf einem
 * anderen Floor ein anderes Ziel. Danach faellt ein Ziel weg, das die neue
 * Szene nicht mehr anbietet; am Ende verschwindet nur der Ankunftshinweis.
 */
export function useFloorSelectionLifecycle({
  scene, selection, pathIndex, pathLength, setSelection, close,
}: SelectionLifecycle): void {
  const sceneKey = useRef(scene.key);

  useEffect(() => {
    if (sceneKey.current === scene.key) return;
    sceneKey.current = scene.key;
    if (selection.current) close();
  }, [scene.key, selection, close]);

  useEffect(() => {
    if (selection.current && !floorTapAllowed(scene.kind, selection.current.target.kind)) close();
  }, [scene.kind, selection, close]);

  useEffect(() => {
    if (pathIndex < pathLength) return;
    setSelection((current) => current?.status === 'Läuft hin …'
      ? { ...current, status: '' }
      : current);
  }, [pathIndex, pathLength, setSelection]);
}
