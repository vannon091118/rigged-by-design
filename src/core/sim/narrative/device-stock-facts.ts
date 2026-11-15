/**
 * Geräte- und Lager-Facts aus tatsächlichen World-Zuständen komponieren.
 *
 * Jeder Fact wird nur erzeugt, wenn der betreffende Zustand besteht. Ein Fact
 * pro Gerät und Grund entsteht nur einmal – wiederholte Boundary-Läufe erzeugen
 * keinen doppelten Fact für denselben unveränderten Zustand.
 */
import type { WorldState } from '../types';
import { emitDeviceFault, emitStockLow, recentFacts } from './facts';
import type { NarrativeFact } from './types';

function alreadyPending(world: WorldState, furnitureId: number, kind: 'DEVICE_FAULT' | 'STOCK_LOW'): boolean {
  const recent = recentFacts(world, kind);
  if (recent.some((fact) => (fact as NarrativeFact & { furnitureId?: number }).furnitureId === furnitureId)) return true;
  return world.narrative.pending.some(
    (fact) => fact.kind === kind && (fact as NarrativeFact & { furnitureId?: number }).furnitureId === furnitureId,
  );
}

/**
 * Scannt alle Geräte auf defekte oder verstopfte Zustände und emittiert
 * DEVICE_FAULT-Facts. Geräte ohne Schaden oder Verstopfung erzeugen keinen Fact.
 */
export function emitDeviceFaults(world: WorldState): number {
  let emitted = 0;
  for (const item of world.furniture) {
    if (alreadyPending(world, item.id, 'DEVICE_FAULT')) continue;
    if (item.damaged) {
      emitDeviceFault(world, item.id, item.kind, 'DAMAGED');
      emitted += 1;
      continue;
    }
    if (item.clogged) {
      emitDeviceFault(world, item.id, item.kind, 'CLOGGED');
      emitted += 1;
    }
  }
  return emitted;
}

/**
 * Scannt BAR- und STORAGE-Geräte auf leeren Bestand und emittiert STOCK_LOW-Facts.
 * Geräte mit Bestand > 0 erzeugen keinen Fact.
 */
export function emitStockLows(world: WorldState): number {
  let emitted = 0;
  for (const item of world.furniture) {
    if (item.kind !== 'BAR' && item.kind !== 'STORAGE') continue;
    if (alreadyPending(world, item.id, 'STOCK_LOW')) continue;
    if (item.stock <= 0) {
      emitStockLow(world, item.id, item.kind, item.stock);
      emitted += 1;
    }
  }
  return emitted;
}
