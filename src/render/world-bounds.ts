/** Die Kamera-Grenzen sind die echten Weltkanten, nicht die Casino-Vorlage. */
import type { LayoutState } from '../core/sim/layout-types';
import type { WorldBounds } from './floor-camera';

export function worldBoundsOf(view: { readonly size: number; readonly layout?: LayoutState | null }): WorldBounds {
  const size = view.layout?.size ?? view.size;
  return { width: size, height: size };
}
