import { useSyncExternalStore } from 'react';
import { worldStore } from './world-store';
import type { GameView } from './types';

export function useWorldStore(): GameView {
  return useSyncExternalStore(worldStore.subscribe, worldStore.getSnapshot, worldStore.getSnapshot);
}

export { worldStore };
