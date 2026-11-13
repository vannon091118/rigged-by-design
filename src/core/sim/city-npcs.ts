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
import { recordResidentVisitor } from './visitors';

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

export const CITY_NPCS: readonly CityNpcDef[] = [
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

/**
 * Zweiter NPC: Mira traegt, was sie hoert, zwischen Kiez und Markt; nur wenn
 * Mira selbst spricht, faellt die Rolle an eine andere Figur. Die Besetzung
 * kommt vom Aufrufer, damit auch Figuren jenseits der kuratierten drei einen
 * Informanten haben; ohne Angabe bleibt die kuratierte Ausgangslage.
 */
export function informantFor(
  npc: CityNpcDef, peers: readonly CityNpcDef[] = CITY_NPCS,
): CityNpcDef | null {
  const pool = peers.filter((entry) => entry.id !== npc.id);
  if (npc.id !== 'mira') {
    const carrier = pool.find((entry) => entry.id === 'mira');
    if (carrier) return carrier;
  }
  return pool.find((entry) => entry.location !== npc.location) ?? pool[0] ?? null;
}

/**
 * Der Zeuge der zweiten Stufe: nicht der Sprecher und nicht der Empfaenger der
 * ersten Weitergabe. Die Kette kommt aus derselben Besetzung wie der Informant.
 */
export function witnessFor(
  npc: CityNpcDef, peers: readonly CityNpcDef[] = CITY_NPCS,
): CityNpcDef | null {
  const informant = informantFor(npc, peers);
  return peers.find((entry) => entry.id !== npc.id && entry.id !== informant?.id) ?? null;
}

/**
 * Das Profil eines Bewohners wird ueber seine Kennung gefunden, nie ueber den
 * Namen: Ein Gast mit demselben Namen ist ein anderer Mensch. Nur alte Saves
 * ohne Kennung werden einmal adoptiert — danach traegt das Profil sie selbst.
 */
export function ensureCityVisitor(world: WorldState, def: CityNpcDef): Visitor {
  const linked = world.visitors.find((visitor) => visitor.residentNpcId === def.id);
  const legacy = linked ? null : world.visitors.find((visitor) =>
    visitor.residentNpcId === undefined && visitor.name === def.name);
  const visitor = linked
    ?? (legacy ? adoptLegacyProfile(legacy, def.id) : recordResidentVisitor(world, {
      npcId: def.id, name: def.name, persona: def.persona,
    }));
  if (visitor.charisma === undefined || visitor.intellect === undefined || !visitor.traits) {
    visitor.charisma = def.charisma;
    visitor.intellect = def.intellect;
    visitor.vice = def.vice;
    visitor.traits = seedTraits(def.traits, { charisma: def.charisma, intellect: def.intellect });
  }
  return visitor;
}

/** Ein Profil aus einem Save vor den Kennungen bekommt seinen Bewohner. */
function adoptLegacyProfile(visitor: Visitor, npcId: string): Visitor {
  visitor.residentNpcId = npcId;
  return visitor;
}

export const locationName = (id: CityLocationId): string =>
  LOCATIONS.find((entry) => entry.id === id)?.name ?? id;
