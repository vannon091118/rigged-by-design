/**
 * Besucherdisposition (E1): eine einzige reine Ableitung aus Persona-Basis,
 * hoechstens sechs Erinnerungen und gerichteten Kanten. Kein neuer Zustand,
 * kein RNG, keine Uhr, keine Mutation. Alle drei E2E-Projektionen
 * (`chooseActivity`, `offerScore`, `returnChance`) lesen dieselbe Funktion.
 *
 * Abbildung auf die Projektionen (D4):
 * - `gameBias` ist ein Faktor-Offset in [-0.2, +0.2] fuer `offerScore()`.
 * - `serviceBias` verschiebt die Drink-Schwellen in Punkten, [-8, +8].
 * - `socialBias` verschiebt die Sofa-Schwellen in Punkten, [-8, +8].
 * - `returnBias` ist ein Beziehungszuschlag in Prozentpunkten, [-10, +10],
 *   zusaetzlich zum vorhandenen `memoryEffect()`; die Rueckkehr bleibt geklemmt.
 * Die Persona-Basis speist Spiel-, Service- und Sozialneigung, die Kante
 * `visitor -> player` bzw. `player -> visitor` (`trust`, `sympathy`, `conflict`)
 * alle vier Modifikatoren, die Erinnerung alle ausser der Rueckkehr (dort wirkt
 * weiter `memoryEffect()` als duenne Fassade ueber `scoreMemories()`).
 */
import { getPersona } from '../personas';
import { rumorAbout } from './knowledge';
import type { Guest, PersonaId, Visitor, WorldState } from '../types';
import { NARRATIVE_LIMITS, type RelationshipEdge, type VisitorMemory } from './types';

export interface VisitorDisposition {
  readonly gameBias: number;
  readonly serviceBias: number;
  readonly socialBias: number;
  readonly returnBias: number;
}

/** Neutrale Disposition fuer Gaeste ohne bekanntes Profil; aendert keine Entscheidung. */
export const NEUTRAL_DISPOSITION: VisitorDisposition = {
  gameBias: 0, serviceBias: 0, socialBias: 0, returnBias: 0,
};

export interface MemoryScore {
  readonly returnPoints: number;
  readonly moodPoints: number;
}

const GOOD_RETURN = 4;
const BAD_RETURN = -6;
const GOOD_MOOD = 6;
const BAD_MOOD = -4;
const RETURN_CAP = 12;
const MOOD_CAP_LOW = -8;
const MOOD_CAP_HIGH = 10;

const GAME_CAP = 0.2;
const THRESHOLD_CAP = 8;
const RETURN_BIAS_CAP = 10;

/**
 * Einzige Gedaechtniswertung im Code: die letzte Erinnerung zaehlt doppelt,
 * damit ein Praegendes den Ausschlag gibt. Rein aus gespeicherten Daten.
 */
export function scoreMemories(memories: readonly VisitorMemory[]): MemoryScore {
  const recent = memories.slice(-NARRATIVE_LIMITS.memories);
  let ret = 0;
  let mood = 0;
  for (const [index, memory] of recent.entries()) {
    const weight = index === recent.length - 1 ? 2 : 1;
    if (memory.valence === 'GOOD') {
      ret += GOOD_RETURN * weight;
      mood += GOOD_MOOD * weight;
    } else if (memory.valence === 'BAD') {
      ret += BAD_RETURN * weight;
      mood += BAD_MOOD * weight;
    }
  }
  return {
    returnPoints: Math.max(-RETURN_CAP, Math.min(RETURN_CAP, ret)),
    moodPoints: Math.max(MOOD_CAP_LOW, Math.min(MOOD_CAP_HIGH, mood)),
  };
}

interface PersonaBase {
  readonly game: number;
  readonly service: number;
  readonly social: number;
}

const PERSONA_BASE: Readonly<Record<PersonaId, PersonaBase>> = {
  LUMPEN: { game: -0.05, service: 0, social: 1 },
  STREET: { game: 0, service: 0, social: 2 },
  BUSINESS: { game: 0.05, service: -2, social: -2 },
  HIGH_ROLLER: { game: 0.1, service: -3, social: -3 },
  STAMMGAST: { game: 0.05, service: 3, social: 3 },
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Summierte Haltung der Kante Besucher <-> Haus; positiv heisst zugewandt. */
function edgeTilt(visitor: Visitor, relationships: readonly RelationshipEdge[]): number {
  const ref = `visitor:${visitor.id}`;
  let tilt = 0;
  for (const edge of relationships) {
    if (edge.from === ref && edge.to === 'player') tilt += edge.sympathy + edge.trust - edge.conflict;
    else if (edge.from === 'player' && edge.to === ref) tilt += edge.sympathy + edge.trust - edge.conflict;
  }
  return clamp(tilt, -RETURN_BIAS_CAP, RETURN_BIAS_CAP);
}

/** Leitet wenige Modifikatoren aus Persona, Erinnerung und Kante ab. */
export function visitorDisposition(
  visitor: Visitor,
  relationships: readonly RelationshipEdge[],
): VisitorDisposition {
  const base = PERSONA_BASE[getPersona(visitor.persona).id] ?? PERSONA_BASE.STAMMGAST;
  const memory = scoreMemories(visitor.memories ?? []);
  const tilt = edgeTilt(visitor, relationships);
  const mood = memory.moodPoints;
  return {
    gameBias: Math.round(clamp(base.game + mood / 100 + tilt / 100, -GAME_CAP, GAME_CAP) * 100) / 100,
    serviceBias: Math.round(clamp(base.service + mood / 2 + tilt / 2, -THRESHOLD_CAP, THRESHOLD_CAP)),
    socialBias: Math.round(clamp(base.social + mood / 4 + tilt / 2, -THRESHOLD_CAP, THRESHOLD_CAP)),
    returnBias: Math.round(clamp(tilt, -RETURN_BIAS_CAP, RETURN_BIAS_CAP)),
  };
}

/** Loest die Disposition eines Gastes ueber sein Profil auf; unbekannt heisst neutral. */
export function dispositionOfGuest(world: WorldState, guest: Guest): VisitorDisposition {
  if (guest.visitorId === undefined) return NEUTRAL_DISPOSITION;
  const visitor = world.visitors.find((entry) => entry.id === guest.visitorId);
  if (!visitor) return NEUTRAL_DISPOSITION;
  const base = visitorDisposition(visitor, world.narrative.relationships);
  // Gehoertes verschiebt die Service-Schwelle begrenzt: guter Ruf oeffnet die Bar,
  // schlechter Ruf haelt Gaeste davon ab. Ohne Wissen bleibt alles wie bisher.
  const rumor = rumorAbout(world, `visitor:${visitor.id}`);
  if (rumor === 0) return base;
  return {
    ...base,
    serviceBias: Math.round(clamp(base.serviceBias + rumor * 4, -THRESHOLD_CAP, THRESHOLD_CAP)),
  };
}
