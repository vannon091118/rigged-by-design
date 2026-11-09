/**
 * Benannte Figuren der Stadt. Die Identitaet ist keine Anzeige: Name, Rolle,
 * Ort, Charisma, Intelligenz und Eigenschaften stehen hier, der besuchende NPC
 * haelt Beziehung und Erinnerung im Save. Die Traits sind kuratiert, damit die
 * drei Figuren eine erklaerbare Ausgangslage haben; das Vergabemodell fuer
 * weitere NPCs zieht dieselben 30 Eigenschaften seedfest nach Stats.
 */
import type { PersonaId, Visitor, WorldState } from './types';
import { LOCATIONS } from './city-model';
import type { CityLocationId, TraitId } from './city-types';
import { seedTraits } from './city-traits';
import { recordVisitor } from './visitors';

export interface CityNpcDef {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly location: CityLocationId;
  readonly persona: PersonaId;
  readonly charisma: number;
  readonly intellect: number;
  readonly vice: number;
  readonly traits: readonly TraitId[];
}

const CITY_NPCS: readonly CityNpcDef[] = [
  {
    id: 'rita', name: 'Rita Kern', role: 'Wirtin der Kiez-Kneipe', location: 'KIEZ', persona: 'STAMMGAST',
    charisma: 8, intellect: 4, vice: 2, traits: ['HILFSBEREIT', 'MITTEILSAM'],
  },
  {
    id: 'boris', name: 'Boris Falk', role: 'Standaufseher der Marktgasse', location: 'MARKT', persona: 'BUSINESS',
    charisma: 4, intellect: 9, vice: 1, traits: ['MISSTRAUISCH', 'EINZELGAENGER'],
  },
  {
    // Sie traegt, was sie hoert, weiter: Herkunft und Ziel liegen in verschiedenen Orten.
    id: 'mira', name: 'Mira Sol', role: 'Laeuferin zwischen Kiez und Markt', location: 'MARKT', persona: 'STREET',
    charisma: 9, intellect: 3, vice: 4, traits: ['LASTERMAUL', 'GERUECHTEMACHER'],
  },
];

export function npcByName(name: string): CityNpcDef | null {
  return CITY_NPCS.find((entry) => entry.name === name) ?? null;
}

/** Die erste Figur eines Ortes ist der feste Ansprechpartner der Stadtaktion. */
export function primaryNpcAt(location: CityLocationId): CityNpcDef | null {
  return CITY_NPCS.find((entry) => entry.location === location) ?? null;
}

/**
 * Zweiter NPC: Mira traegt, was sie hoert, zwischen Kiez und Markt; nur wenn
 * Mira selbst spricht, faellt die Rolle an eine andere Figur. Distanz 0 -> 1
 * bleibt damit echt und die zweite Stufe geht an Boris.
 */
export function informantFor(npc: CityNpcDef): CityNpcDef | null {
  if (npc.id !== 'mira') {
    const carrier = CITY_NPCS.find((entry) => entry.id === 'mira');
    if (carrier) return carrier;
  }
  return CITY_NPCS.find((entry) => entry.id !== npc.id && entry.location !== npc.location)
    ?? CITY_NPCS.find((entry) => entry.id !== npc.id)
    ?? null;
}

/**
 * Der Zeuge der zweiten Stufe: nicht der Sprecher und nicht der Empfaenger der
 * ersten Weitergabe. Damit entsteht eine echte Kette Rita -> Mira -> Boris.
 */
export function witnessFor(npc: CityNpcDef): CityNpcDef | null {
  const informant = informantFor(npc);
  return CITY_NPCS.find((entry) => entry.id !== npc.id && entry.id !== informant?.id) ?? null;
}

/** Der benannte NPC existiert genau einmal; ein alter Save behaelt seine ID. */
export function ensureCityVisitor(world: WorldState, def: CityNpcDef): Visitor {
  const existing = world.visitors.find((visitor) => visitor.name === def.name);
  const visitor = existing ?? recordVisitor(world, { name: def.name, persona: def.persona, tick: world.tick });
  if (visitor.charisma === undefined || visitor.intellect === undefined || !visitor.traits) {
    visitor.charisma = def.charisma;
    visitor.intellect = def.intellect;
    visitor.vice = def.vice;
    visitor.traits = seedTraits(def.traits, { charisma: def.charisma, intellect: def.intellect });
  }
  return visitor;
}

export const locationName = (id: CityLocationId): string =>
  LOCATIONS.find((entry) => entry.id === id)?.name ?? id;
