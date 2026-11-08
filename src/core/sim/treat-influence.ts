/**
 * Döner-/Treat-Wirkung: liest den Kontext aus dem Zielmoebel und die
 * Gewichtungen aus der Influence-Config. Kein Sonderpfad im Consumer.
 */
import {
  influenceContextForFurniture, treatInfluence,
  type InfluenceConfig, type InfluenceValues,
} from './influence';
import { actorRefOfVisitor, relationshipBetween, shift } from './narrative/relationships';
import type { Guest, WorldState } from './types';

/** Wendet die Treat-Wirkung an und liefert den konfigurierten Score-Anteil. */
export function applyTreatInfluence(world: WorldState, guest: Guest, config: InfluenceConfig): number {
  const target = world.furniture.find((item) => item.id === guest.targetFurniture);
  const context = influenceContextForFurniture(target?.kind ?? '', config);
  const visitor = guest.visitorId === undefined ? null : actorRefOfVisitor(guest.visitorId);
  const edge = visitor ? relationshipBetween(world, visitor, 'player') : null;
  const values: InfluenceValues = {
    mood: guest.mood, sociability: guest.sociability, thirst: guest.thirst,
    rumor: 0, trust: edge?.trust ?? 0, sympathy: edge?.sympathy ?? 0, conflict: edge?.conflict ?? 0,
    satisfaction: 100,
  };
  const treat = treatInfluence(context, values, config);
  if (visitor && treat > 0) {
    shift(world, visitor, 'player', {
      trust: treat * 6,
      sympathy: treat * 6,
      conflict: -treat * 3,
    }, world.tick);
  }
  return treat;
}
