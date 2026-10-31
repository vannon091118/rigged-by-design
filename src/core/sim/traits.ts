/** Gast-Erzeugung: Persona plus zufaellig verteilter Max-Pool fuer Laune, Geduld und Sucht. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { pickWeighted } from '../rng/weighted';
import { getPersona, personasForTier } from './personas';
import type { DemandTier, Guest, PersonaId, Point, TemplateId } from './types';

const NAMES = ['Kai', 'Rita', 'Bruno', 'Nadja', 'Otis', 'Mira', 'Falk', 'Sina', 'Timo', 'Lena', 'Emil', 'Jule', 'Mika'];
const LAST_NAMES = ['Vogt', 'Berger', 'Kern', 'Roth', 'Adler', 'Busch', 'Dorn', 'Fink', 'Held', 'Kraus'];
import { rollProfile } from './needs';
const TIER: Record<TemplateId, 1 | 2 | 3> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };
const PERSONA_WEIGHT: Record<PersonaId, number> = {
  LUMPEN: 4, STREET: 4, BUSINESS: 2, HIGH_ROLLER: 1, STAMMGAST: 3,
};

/** Ein 180-Punkte-Max-Pool; die Persona verschiebt den Suchtanteil. */
function splitPool(prng: Prng, persona: PersonaId): [number, number, number] {
  return rollProfile(prng, getPersona(persona).addictionRate);
}

/** Die Progression bestimmt, welche Gaeste kommen: Business und High Roller brauchen eine hoehere Stufe. */
export function personaTier(tier: DemandTier): 1 | 2 | 3 {
  if (tier === 'SAAL') return 2;
  if (tier === 'KONZERN') return 3;
  return 1;
}

export function randomPersona(prng: Prng, tier: 1 | 2 | 3): PersonaId {
  const pool = personasForTier(tier);
  const picked = pickWeighted(prng, pool.map((persona) => ({ item: persona, weight: PERSONA_WEIGHT[persona.id] })));
  return picked?.id ?? pool[0]!.id;
}

export function randomFiat(prng: Prng, template: TemplateId, personaId: PersonaId): VaCoinMicro {
  const base = TIER[template] === 1 ? 9 : TIER[template] === 2 ? 18 : 34;
  const persona = getPersona(personaId);
  return fromVC(Math.max(1, Math.round(base * persona.budgetFactor * (0.7 + prng.nextFloat() * 0.9))));
}

export function makeGuest(input: {
  id: number;
  persona: PersonaId;
  prng: Prng;
  spawn: Point;
}): Guest {
  const persona = getPersona(input.persona);
  const [mood, patience, addiction] = splitPool(input.prng, input.persona);
  return {
    id: input.id,
    name: `${NAMES[input.prng.nextInt(0, NAMES.length - 1)]!} ${LAST_NAMES[input.prng.nextInt(0, LAST_NAMES.length - 1)]!}`,
    persona: persona.id,
    mood,
    patience,
    addiction,
    sociability: input.prng.nextInt(30, 100),
    thirst: 10 + input.prng.nextInt(0, 20),
    bladder: input.prng.nextInt(0, 25),
    disputeId: null,
    state: 'ENTER',
    stateTicks: 0,
    position: { ...input.spawn },
    path: [],
    pathIndex: 0,
    targetFurniture: 0,
    targetZone: 'entrance',
    queueIndex: 0,
    need: 'play',
    anger: 0,
    dirtTimer: 0,
    lastResult: '',
    spins: 0,
  };
}
