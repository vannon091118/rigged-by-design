/**
 * Ausstattungsreaktion (Agent 15): die Bedingung des Geraets, an dem ein Gast
 * tatsaechlich gespielt hat, verschiebt die gerichtete Kante Besucher -> Haus.
 *
 * Die Regel ist rein aus dem gespeicherten Zustand abgeleitet (kein RNG, keine
 * Uhr) und benutzt denselben `shift()`-Writer wie Besuch, Streit, Kasse und
 * Rivalenabrechnung (`narrative/relationship-apply.ts`). Es entsteht kein neuer
 * Fact-Kind, kein zweiter Zustand und keine zweite Beziehungslogik:
 * `NARRATIVE_FACT_KINDS` bleibt bei den elf bekannten Kinds, `visitors.ts`,
 * `narrative/disposition.ts` und `narrative/memory.ts` bleiben unveraendert.
 */
import { actorRefOfVisitor, shift } from './narrative/relationships';
import type { Furniture, Guest, WorldState } from './types';

/** Zustand des Geraets, wie der Gast ihn erlebt hat. */
type AmenityGrade = 'KEPT' | 'WORN' | 'BROKEN';

/** Ab hier gilt ein Geraet als abgenutzt; deckt sich mit dem Wartungsbild der Halle. */
export const WORN_BELOW = 35;

/** Deterministische Stufe aus Schaden und Zustand des Geraets. */
export function amenityGradeOf(item: Pick<Furniture, 'condition' | 'damaged'>): AmenityGrade {
  if (item.damaged) return 'BROKEN';
  return item.condition < WORN_BELOW ? 'WORN' : 'KEPT';
}

const REACTION: Readonly<Record<AmenityGrade, { readonly trust: number; readonly sympathy: number; readonly conflict: number }>> = {
  KEPT: { trust: 1, sympathy: 1, conflict: 0 },
  WORN: { trust: 0, sympathy: -1, conflict: 0 },
  BROKEN: { trust: -1, sympathy: -2, conflict: 1 },
};

/**
 * Wendet die Reaktion an und liefert die erlebte Stufe; `null` heisst: der Gast
 * hat kein Profil, dann gibt es niemanden, dessen Beziehung sich aendern koennte.
 */
export function applyAmenityReaction(world: WorldState, guest: Guest, item: Furniture): AmenityGrade | null {
  if (guest.visitorId === undefined) return null;
  if (!world.visitors.some((visitor) => visitor.id === guest.visitorId)) return null;
  const grade = amenityGradeOf(item);
  shift(world, actorRefOfVisitor(guest.visitorId), 'player', REACTION[grade], world.tick);
  return grade;
}
