/** Fleck-/Verschmutzungssystem. Headless, deterministisch, keine Browser-Abhängigkeiten. */
import type { Ledger } from '../economy/ledger';
import { HAUSKONTO, SHOP } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { dirtyTileIndex } from './emotion';

interface Stain {
  readonly id: number;
  x: number;
  y: number;
  readonly dirtValue: number;
  readonly influenceRadius: number;
  readonly removeDurationTicks: number;
  ticksRemaining: number;
  createdAt: number;
}

export function spawnStain(world: WorldState, x: number, y: number, dirtValue: number): void {
  const clamped = Math.min(100, Math.max(1, dirtValue));
  const stain: Stain = {
    id: world.nextStainId++,
    x, y,
    dirtValue: clamped,
    influenceRadius: Math.min(3, Math.ceil(clamped / 25)),
    removeDurationTicks: Math.max(3, Math.ceil(clamped / 15)),
    ticksRemaining: 0,
    createdAt: world.tick,
  };
  world.stains.push(stain);
  world.dirty.add(dirtyTileIndex(world.size, x, y));
  world.lastEvent = `Fleck entstanden (Verschmutzung ${clamped}).`;
}

export function removeStain(world: WorldState, ledger: Ledger, stainId: number): boolean {
  const index = world.stains.findIndex((s) => s.id === stainId);
  if (index === -1) return false;
  const stain = world.stains[index];
  world.stains.splice(index, 1);
  ledger.transfer(HAUSKONTO, SHOP, world.prices.cleaningCost, TX_REASON.CLEANING, world.tick);
  world.lastEvent = `Fleck entfernt (Verschmutzung ${stain.dirtValue}).`;
  return true;
}
