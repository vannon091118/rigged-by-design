/** Floor-Input: Tap-Logik, baut Radial-Menü-Aktionen und ruft Callbacks. */
import type { FederatedPointerEvent } from 'pixi.js';
import type { WorldState } from '../core/sim/types';
import { TILE } from '../core/sim/types';
import { buildStainActions, buildGuestActions, buildFurnitureActions, type MenuAction } from './floor-actions';

export interface FloorCallbacks {
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
  readonly onOpenMenu: (actions: MenuAction[], x: number, y: number) => void;
  readonly onCloseMenu: () => void;
}

export function handleTap(
  event: FederatedPointerEvent,
  point: { x: number; y: number },
  view: WorldState,
  cues: { ping: (p: { x: number; y: number }) => void },
  callbacks: FloorCallbacks,
  placing: boolean,
  lod: number,
  zoomToArea: (x: number, y: number) => void,
): void {
  if (event.button !== 0) return;
  const x = Math.floor(point.x / TILE);
  const y = Math.floor(point.y / TILE);
  if (x < 0 || y < 0 || x >= view.size || y >= view.size) return;
  cues.ping({ x, y });

  const openMenu = (actions: MenuAction[]) => {
    callbacks.onOpenMenu(actions, point.x, point.y);
  };

  const stain = view.stains.find((s) => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
  if (stain) {
    openMenu(buildStainActions(view, stain));
    return;
  }

  const guest = view.guests
    .map((entry) => ({ entry, distance: Math.abs(entry.position.x - x) + Math.abs(entry.position.y - y) }))
    .filter((entry) => entry.distance <= 1)
    .sort((a, b) => a.distance - b.distance)[0];
  if (guest) {
    openMenu(buildGuestActions(view, guest.entry));
    return;
  }

  const furniture = view.furniture.find((item) =>
    x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
  if (furniture) {
    openMenu(buildFurnitureActions(view, furniture));
    return;
  }

  if (lod === 0 && !placing) { zoomToArea(x, y); return; }
  callbacks.onEmpty(x, y);
}
