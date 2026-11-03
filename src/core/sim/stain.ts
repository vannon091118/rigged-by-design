/**
 * Fleck-/Verschmutzungssystem.
 * Headless, deterministisch, keine Browser-Abhängigkeiten.
 * Jeder Fleck hat einen eigenen Verschmutzungswert, der Einfluss auf Umgebung,
 * Reichweite des Einflusses und Dauer des Entfernens bestimmt.
 * Generisch — keine Hardcodierung spezifischer Floors oder Toiletten.
 */

import type { Ledger } from '../economy/ledger';
import { HAUSKONTO, SHOP } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { dirtyTileIndex } from './emotion';

export interface Stain {
  readonly id: number;
  x: number;
  y: number;
  /** Verschmutzungswert (0..100): bestimmt Stärke des Umgebungs-Einflusses */
  readonly dirtValue: number;
  /** Reichweite des Einflusses in Tiles (0..3) */
  readonly influenceRadius: number;
  /** Ticks bis zum kompletten Entfernen bei Reinigung */
  readonly removeDurationTicks: number;
  /** Verbleibende Ticks bis Entfernung (wird bei jedem Reinigungs-Tick reduziert) */
  ticksRemaining: number;
  createdAt: number;
}

/**
 * Erzeugt einen neuen Fleck an der angegebenen Position.
 * Der Verschmutzungswert bestimmt:
 *  - influenceRadius: wie weit der Fleck die Umgebung beeinträchtigt
 *  - removeDurationTicks: wie lange das vollständige Entfernen dauert
 */
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

/**
 * Entfernt einen Fleck vollständig und bucht Reinigungskosten.
 * @returns true wenn der Fleck entfernt wurde, false wenn nicht gefunden
 */
export function removeStain(world: WorldState, ledger: Ledger, stainId: number): boolean {
  const index = world.stains.findIndex((s) => s.id === stainId);
  if (index === -1) return false;
  const stain = world.stains[index];
  world.stains.splice(index, 1);
  ledger.transfer(HAUSKONTO, SHOP, world.prices.cleaningCost, TX_REASON.CLEANING, world.tick);
  world.lastEvent = `Fleck entfernt (Verschmutzung ${stain.dirtValue}).`;
  return true;
}

/**
 * Gibt den Umgebungs-Einfluss eines Flecks zurück.
 * radius: wie viele Tiles um den Fleck herum betroffen sind
 * strength: wie stark der Einfluss ist (0..100)
 */
export function getStainInfluence(stain: Stain): { radius: number; strength: number } {
  return { radius: stain.influenceRadius, strength: stain.dirtValue };
}

/**
 * Reduziert ticksRemaining aller Flecken um 1 (wird pro Tick aufgerufen).
 * Flecken mit ticksRemaining <= 0 werden nicht automatisch entfernt —
 * Entfernung erfolgt nur durch aktive Reinigung durch den Spieler.
 */
export function tickStains(world: WorldState): void {
  for (const stain of world.stains) {
    if (stain.ticksRemaining > 0) {
      stain.ticksRemaining -= 1;
    }
  }
}
