/** Gemeinsame Gast-Basis ohne Entscheidungs- oder Spielwissen. */
import type { Guest, WorldState } from './types';
import { releaseSeat } from './world';

export const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function moveGuest(guest: Guest): boolean {
  if (guest.pathIndex >= guest.path.length) return true;
  guest.position = { ...guest.path[guest.pathIndex]! };
  guest.pathIndex += 1;
  return guest.pathIndex >= guest.path.length;
}

export function releaseAndChoose(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.targetFurniture = 0;
  guest.path = [];
  guest.pathIndex = 0;
  guest.state = 'CHOOSE';
  guest.stateTicks = 0;
}
