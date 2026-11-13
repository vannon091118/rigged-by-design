/** Besucherprofile: Gaeste bleiben ueber Besuche hinweg erkennbar; die Liste ist begrenzt. */
import type { PersonaId, Visitor, WorldState } from './types';
import { visitorDisposition } from './narrative/disposition';
import { memoryEffect } from './narrative/memory';
import type { RelationshipEdge } from './narrative/types';
import { pinnedVisitorIds } from './narrative/relationships';

export const VISITOR_CAP = 40;
/** Rueckkehr-Chance (Prozent) bei neutralem Erlebnis (50). Gute Erlebnisse erhoehen sie, schlechte senken sie bis 0. */
const RETURN_PERCENT = 25;
const NEUTRAL_EXPERIENCE = 50;

/** Legt ein neues Profil an oder verdraengt bei vollem Speicher das am laengsten nicht gesehene. */
export function recordVisitor(
  world: WorldState,
  input: { name: string; persona: PersonaId; tick: number },
): Visitor {
  const visitor: Visitor = {
    id: world.nextVisitorId++,
    name: input.name,
    persona: input.persona,
    visits: 1,
    lastSeenTick: input.tick,
    memories: [],
  };
  world.visitors.push(visitor);
  if (world.visitors.length > VISITOR_CAP) {
    // Aktive Beziehungen pinnen ihre Endpunkte, offene Szenen ihre Teilnehmer; ohne
    // freien Kandidaten bleibt die Liste bewusst ueber dem Cap, statt eine laufende
    // Geschichte zu verlieren.
    const pinned = pinnedVisitorIds(world);
    let oldest = -1;
    for (let i = 0; i < world.visitors.length; i += 1) {
      // Der neue Besucher ist nie der Eviction-Kandidat; sonst verdraengt er sich selbst.
      if (world.visitors[i]!.id === visitor.id || pinned.has(world.visitors[i]!.id)) continue;
      // Bewohnerprofile gehoeren zur Stadt, nicht zum Gastpool: Ihre Kennung
      // muss den Speicher ueberleben, sonst verliert der Bewohner Traits und
      // Erinnerungen an einen Gast, der zufaellig zuletzt da war.
      if (world.visitors[i]!.residentNpcId !== undefined) continue;
      if (oldest < 0 || world.visitors[i]!.lastSeenTick < world.visitors[oldest]!.lastSeenTick) oldest = i;
    }
    if (oldest >= 0) world.visitors.splice(oldest, 1);
  }
  return visitor;
}

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

/**
 * Waehlt deterministisch aus der Gast-ID (kein PRNG-Zug), damit der Zufallsablauf bestehender
 * Spielstaende und Tests unveraendert bleibt. Wer nie da war, ist kein Rueckkehrer:
 * Profile ohne Besuch fallen aus der Auswahl, damit ein frisch angelegter Bewohner
 * nicht als Stammgast gilt.
 */
export function pickReturningVisitor(world: WorldState, guestId: number): Visitor | null {
  const eligible = world.visitors.filter((visitor) => visitor.visits > 0);
  if (eligible.length === 0) return null;
  const hash = Math.imul(guestId, 2654435761) >>> 0;
  const visitor = eligible[(hash >>> 8) % eligible.length];
  if (!visitor || hash % 100 >= returnChance(visitor, world.narrative.relationships)) return null;
  return visitor;
}

/**
 * Erlebnis des letzten Besuchs (0..100) steuert die Rueckkehr; alte Staende zaehlen neutral.
 * Erinnerungen an fruehere Besuche verschieben die Chance zusaetzlich — ohne PRNG, aus dem Save.
 */
export function returnChance(visitor: Visitor, relationships: readonly RelationshipEdge[] = []): number {
  const experience = visitor.experience ?? NEUTRAL_EXPERIENCE;
  const percent = (RETURN_PERCENT * experience) / NEUTRAL_EXPERIENCE
    + memoryEffect(visitor).returnBonus
    + visitorDisposition(visitor, relationships).returnBias;
  return Math.max(0, Math.min(2 * RETURN_PERCENT + 12, percent));
}

/** Haelt das Erlebnis des letzten Besuchs fest, damit die Rueckkehr darauf reagiert. */
export function noteExperience(world: WorldState, visitorId: number, score: number): void {
  const visitor = world.visitors.find((entry) => entry.id === visitorId);
  if (visitor) visitor.experience = Math.round(score);
}

export function markReturning(visitor: Visitor, tick: number): void {
  visitor.visits += 1;
  visitor.lastSeenTick = tick;
}
