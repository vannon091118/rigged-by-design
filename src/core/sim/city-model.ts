/**
 * Stadt-Daten und -Zustand: Orte, Handlungen, Raenge, Energie und der Bezug
 * zum Textpool `city-scene`. Keine UI, kein Geld - nur Fortschritt.
 */
import { NARRATIVE_REGISTRY } from './narrative/composer/registry.generated';
import type { WorldState } from './types';
import type { ActionDef, CityBranchId, CityLocationId, CityState } from './city-types';
import { clamp } from './num';

/** Der Pool, aus dem jede Stadt-Handlung ihren Text zieht. */
export const CITY_SLOT = 'city-scene';
/** Eigener Pool fuer den Tagesabschluss: Ruhe klingt anders als Handel. */
export const NIGHT_SLOT = 'city-night';
/** Energie je Tag: die einzige Bremse des Loops, nachts vollstaendig zurueck. */
export const CITY_ENERGY_PER_DAY = 6;

/** Orte: der eigene Floor ist der Rueckweg, die anderen beiden der Slice. */
export const LOCATIONS: readonly { readonly id: CityLocationId; readonly name: string; readonly note: string }[] = [
  { id: 'CASINO', name: 'Dein Casino', note: 'Der Floor, den du schon kennst. Hier endet der Ausflug.' },
  { id: 'KIEZ', name: 'Kiez-Kneipe', note: 'Rauchig, laut, ehrlich. Kontakte entstehen hier, nicht am Automaten.' },
  { id: 'MARKT', name: 'Marktgasse', note: 'Feilschen, tragen, verhandeln. Der Handel zahlt sich in Reichweite aus.' },
];

export const ACTIONS: readonly ActionDef[] = [
  { id: 'KIEZ_ANSPRECHEN', location: 'KIEZ', label: 'Ein Gespraech anfangen', hint: 'Ein Satz, ein Name, ein naechstes Mal.', energy: 1, branch: 'KIEZ', progress: 1, reputation: 0.4 },
  { id: 'KIEZ_RUNDE', location: 'KIEZ', label: 'Eine Runde ausgeben', hint: 'Kostet mehr Energie, traegt weiter.', energy: 2, branch: 'KIEZ', progress: 2, reputation: 1.1 },
  { id: 'KIEZ_ESSEN', location: 'KIEZ', label: 'Etwas essen', hint: 'Hunger sinkt; der Abend wird wieder tragbar.', energy: 1, branch: 'KIEZ', progress: 0, reputation: 0 },
  { id: 'KIEZ_TRINKEN', location: 'KIEZ', label: 'Etwas trinken', hint: 'Durst sinkt; der Kopf bleibt im Spiel.', energy: 1, branch: 'KIEZ', progress: 0, reputation: 0 },
  { id: 'MARKT_FEILSCHEN', location: 'MARKT', label: 'Um den Preis feilschen', hint: 'Der Handel lernt dich kennen.', energy: 1, branch: 'MARKT', progress: 1, reputation: 0.3 },
  { id: 'MARKT_LIEFERUNG', location: 'MARKT', label: 'Eine Lieferung begleiten', hint: 'Anstrengend, aber die Strasse merkt es sich.', energy: 2, branch: 'MARKT', progress: 2, reputation: 0.9 },
];

/** Raenge je Zweig; der letzte Rang schliesst den Zweig ab. */
export const TIERS: Readonly<Record<CityBranchId, readonly { readonly name: string; readonly at: number }[]>> = {
  KIEZ: [
    { name: 'Fremder', at: 0 },
    { name: 'Gast', at: 4 },
    { name: 'Stammgast', at: 9 },
    { name: 'Eingeweihter', at: 15 },
  ],
  MARKT: [
    { name: 'Laufbursche', at: 0 },
    { name: 'Kramer', at: 3 },
    { name: 'Haendler', at: 7 },
    { name: 'Marktherr', at: 12 },
  ],
};
/** Ab diesem Kiez-Rang ist der Markt offen: der Zweig schaltet den naechsten frei. */
export const MARKET_UNLOCK_AT = 9;
export const ORDER: readonly CityLocationId[] = ['CASINO', 'KIEZ', 'MARKT'];

export const clampEnergy = (value: number): number => clamp(Math.floor(value), 0, CITY_ENERGY_PER_DAY);

/** FNV-1a: derselbe Ort, dieselbe Handlung, derselbe Text - ohne RNG. */
function fnv(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Texte des Stadt-Pools, sortiert nach ID, damit die Auswahl stabil bleibt. */
const CITY_TEXTS: readonly string[] = NARRATIVE_REGISTRY
  .filter((fragment) => fragment.slot === CITY_SLOT)
  .map((fragment) => fragment.text)
  .sort();

/** Deterministischer Pool-Text; wirft, wenn der Pool fehlt oder leer ist. */
export function cityText(key: string): string {
  if (CITY_TEXTS.length === 0) throw new Error(`Pool ${CITY_SLOT} ist leer; die Stadt braucht ihre Texte.`);
  return CITY_TEXTS[fnv(key) % CITY_TEXTS.length]!;
}

/** Texte des Nacht-Pools, ebenfalls stabil sortiert. */
const NIGHT_TEXTS: readonly string[] = NARRATIVE_REGISTRY
  .filter((fragment) => fragment.slot === NIGHT_SLOT)
  .map((fragment) => fragment.text)
  .sort();

/** Text fuer den Tagesabschluss; eigener Pool, damit der Loop nicht wiederholt. */
export function cityNightText(key: string): string {
  if (NIGHT_TEXTS.length === 0) throw new Error(`Pool ${NIGHT_SLOT} ist leer; der Tagesabschluss braucht Text.`);
  return NIGHT_TEXTS[fnv(key) % NIGHT_TEXTS.length]!;
}

function freshCity(day: number): CityState {
  return {
    location: 'CASINO',
    energyDay: day,
    energy: CITY_ENERGY_PER_DAY,
    KIEZ: 0,
    MARKT: 0,
    visits: { CASINO: 0, KIEZ: 0, MARKT: 0 },
    lastResult: 'Die Stadt liegt vor dir: Kiez und Markt sind einen Weg entfernt.',
    lastText: cityText('start|0'),
    completed: [],
    encounters: [],
  };
}

function normalizedCity(state: CityState, day: number): CityState {
  const energy = state.energyDay === day ? clampEnergy(state.energy) : CITY_ENERGY_PER_DAY;
  return { ...state, energyDay: day, energy, encounters: state.encounters ?? [] };
}

/**
 * Reine Sicht auf den Stadtzustand: Ein fehlendes Feld wird fuer die Anzeige
 * als Startzustand projiziert, aber nie in die Welt geschrieben.
 */
export function cityViewState(world: WorldState): CityState {
  return world.city ? normalizedCity(world.city, world.day) : freshCity(world.day);
}

/**
 * Der Stadtzustand entsteht beim ersten schreibenden Zugriff. Alte Saves tragen
 * ihn nicht; ein fehlendes Feld ist deshalb kein Save-Bruch, sondern der
 * Startzustand.
 */
export function cityOf(world: WorldState): CityState {
  const existing = world.city;
  if (existing) return normalizedCity(existing, world.day);
  const fresh = freshCity(world.day);
  world.city = fresh;
  return fresh;
}

/** Rang und naechste Stufe eines Zweigs, ohne UI-Wissen. */
export function tierOf(branch: CityBranchId, points: number): { name: string; next: { name: string; at: number } | null } {
  const tiers = TIERS[branch];
  let name = tiers[0]!.name;
  for (const tier of tiers) if (points >= tier.at) name = tier.name;
  const next = tiers.find((tier) => points < tier.at) ?? null;
  return { name, next: next ? { name: next.name, at: next.at } : null };
}

export const marketUnlocked = (state: CityState): boolean => state.KIEZ >= MARKET_UNLOCK_AT;
export const branchDone = (state: CityState, branch: CityBranchId): boolean => state.completed.includes(branch);
export const finalTier = (branch: CityBranchId): number => TIERS[branch][TIERS[branch].length - 1]!.at;
