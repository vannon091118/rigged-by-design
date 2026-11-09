/** App-Modell: Popup-Ziele, Bau-Fit und Bewegungsachsen; aus App ausgelagert (LOC-Budget). */
import { canPlaceAt } from '../core/sim/grid-zones';
import { getBuildDef, type BuildId } from '../core/sim/offers';
import type { RivalId } from '../core/sim/types';
import type { GameView } from '../store/types';

/** Eine UI-Perspektive, kein zweiter Spielzustand: beide lesen denselben GameView. */
export type Perspective = 'guest' | 'operator';

/** Alles Technische und Persoenliche liegt hinter einer Tuer, nicht in der Hauptleiste. */
export type WorkshopTool =
  | 'journal' | 'diagnostics' | 'assets' | 'sound' | 'controls' | 'fps' | 'device' | 'help';

export type Popup =
  | { kind: 'guests'; guestId: number | null; overview?: boolean }
  | { kind: 'machine'; itemId: number }
  | { kind: 'games'; rivalId?: RivalId }
  | { kind: 'narrative'; visitorId?: number }
  | { kind: 'dialogue'; scriptId?: string }
  | { kind: 'workshop'; tool?: WorkshopTool }
  | { kind: 'look' }
  | { kind: 'foreignMap' }
  | { kind: 'foreignFloor' }
  | { kind: 'jobContext'; stationId: string }
  | { kind: 'city' }
  | null;

export function fits(view: GameView, id: BuildId, x: number, y: number): boolean {
  const def = getBuildDef(id);
  const blockers = [view.player.position, ...view.guests.map((guest) => guest.position)];
  return canPlaceAt(view.size, view.furniture, blockers, x, y, def.w, def.h, def.seats > 0, view.layout);
}

export const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};
