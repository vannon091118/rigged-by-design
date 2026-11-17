/**
 * Bewohnerprofil anlegen: Blattmodul ohne Rueckweg in die Stadt- oder
 * Narrativ-Schicht.
 *
 * `city-npcs` braucht nur diese eine Funktion aus `visitors`. Lag sie dort,
 * entstand ein Zyklus ueber `visitors -> narrative/memory -> city-life-state ->
 * city-life-create -> city-npc-roster -> city-npcs`; je nach Einstiegspunkt war
 * `CITY_NPCS` dann noch nicht initialisiert und `CITY_NPCS.length` warf.
 * Dieses Modul haengt nur an Typen, damit der Zyklus nicht zurueckkommt.
 */
import type { PersonaId, Visitor, WorldState } from './types';

/**
 * Profil eines Stadtbewohners. Es entsteht ohne Besuch (`visits: 0`) und traegt
 * seine Kennung: Der Bewohner hat eine Identitaet, lange bevor er als Gast
 * auftaucht. Erst ein echter Besuch macht ihn zum Rueckkehrer.
 */
export function recordResidentVisitor(
  world: WorldState,
  input: { npcId: string; name: string; persona: PersonaId },
): Visitor {
  const visitor: Visitor = {
    id: world.nextVisitorId++,
    name: input.name,
    persona: input.persona,
    residentNpcId: input.npcId,
    visits: 0,
    lastSeenTick: 0,
    memories: [],
  };
  world.visitors.push(visitor);
  return visitor;
}
