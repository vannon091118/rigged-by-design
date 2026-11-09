/**
 * Benannte Figuren der Stadt. Die Identitaet ist keine Anzeige: Name, Rolle und
 * Ort stehen hier, der besuchende NPC haelt Beziehung und Erinnerung im Save.
 */
import type { PersonaId, Visitor, WorldState } from './types';
import { LOCATIONS } from './city-model';
import type { CityLocationId } from './city-types';
import { recordVisitor } from './visitors';

export interface CityNpcDef {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly location: CityLocationId;
  readonly persona: PersonaId;
}

const CITY_NPCS: readonly CityNpcDef[] = [
  { id: 'rita', name: 'Rita Kern', role: 'Wirtin der Kiez-Kneipe', location: 'KIEZ', persona: 'STAMMGAST' },
  { id: 'boris', name: 'Boris Falk', role: 'Standaufseher der Marktgasse', location: 'MARKT', persona: 'BUSINESS' },
  // Sie traegt, was sie hoert, weiter: Herkunft und Ziel liegen in verschiedenen Orten.
  { id: 'mira', name: 'Mira Sol', role: 'Laeuferin zwischen Kiez und Markt', location: 'MARKT', persona: 'STREET' },
];

export function npcByName(name: string): CityNpcDef | null {
  return CITY_NPCS.find((entry) => entry.name === name) ?? null;
}

/** Die erste Figur eines Ortes ist der feste Ansprechpartner der Stadtaktion. */
export function primaryNpcAt(location: CityLocationId): CityNpcDef | null {
  return CITY_NPCS.find((entry) => entry.location === location) ?? null;
}

/** Zweiter NPC: andere Person an einem anderen Ort; Distanz 0 -> 1 ist echt. */
export function informantFor(npc: CityNpcDef): CityNpcDef | null {
  return CITY_NPCS.find((entry) => entry.id !== npc.id && entry.location !== npc.location)
    ?? CITY_NPCS.find((entry) => entry.id !== npc.id)
    ?? null;
}

/** Der benannte NPC existiert genau einmal; ein alter Save behaelt seine ID. */
export function ensureCityVisitor(world: WorldState, def: CityNpcDef): Visitor {
  const existing = world.visitors.find((visitor) => visitor.name === def.name);
  if (existing) return existing;
  return recordVisitor(world, { name: def.name, persona: def.persona, tick: world.tick });
}

export const locationName = (id: CityLocationId): string =>
  LOCATIONS.find((entry) => entry.id === id)?.name ?? id;
