/**
 * @module city-npc-roster — wer in der Stadt wohnt, ist eine Funktion des Index
 *
 * Die drei kuratierten Figuren sind der Anfang der Liste, nicht ihr Umfang:
 * `rosterDefAt(index)` liefert für jeden Index eine vollständige Figur — Name,
 * Rolle, Ort, Persona, Charisma, Intellekt, Laster und zwei Eigenschaften — und
 * zwar seedfest, also ohne Zufall und ohne eigene Tabelle pro Person. Damit hat
 * jeder gespawnte NPC dieselben Rechte wie Rita, Boris und Mira: ein Profil,
 * eine Schicht, eigene Traits, Beziehungen und Erinnerungen.
 *
 * Die Kennung ist der Index: `rita`, `boris`, `mira` für 0..2, danach
 * `npc_4`, `npc_5`, ... Ein Save nennt nur die Kennung; alles andere laesst
 * sich daraus wieder herleiten.
 */
import { CITY_NPCS, type CityNpcDef } from './city-npcs';
import { TRAITS } from './city-traits';
import type { PersonaId } from './types-model';
import type { CityLocationId, TraitId } from './city-types';

/** Bewohner beim ersten Start; mehr geht jederzeit ueber `ensureCityPopulation`. */
export const CITY_POPULATION_DEFAULT = CITY_NPCS.length;

/**
 * Bevoelkerung, sobald der Spieler auf die Strasse tritt. Die drei kuratierten
 * Figuren sind der Anfang; die Stadt fuellt sich beim ersten Schritt vor die
 * Tuer, damit ein Kiez nicht aus drei Gesichtern besteht.
 */
export const CITY_POPULATION_STREET = 12;

const FIRST_NAMES: readonly string[] = [
  'Nadja', 'Selin', 'Tobias', 'Imke', 'Rustam', 'Pauline', 'Kenan', 'Anke',
  'Viktor', 'Leyla', 'Malte', 'Sonja', 'Emre', 'Greta', 'Jannis', 'Derya',
  'Ole', 'Fatima', 'Henrik', 'Marlene', 'Sven', 'Ayla', 'Kilian', 'Nurgul',
  'Anton', 'Rieke', 'Timo', 'Zeynep', 'Bruno', 'Lotte', 'Murat', 'Ilse',
];

const LAST_NAMES: readonly string[] = [
  'Brandt', 'Yilmaz', 'Krueger', 'Sander', 'Oestreich', 'Pahl', 'Demir',
  'Wiek', 'Lasch', 'Behrens', 'Hoyer', 'Kaya', 'Sturm', 'Reimers', 'Dorn',
  'Albers', 'Fuchs', 'Sahin', 'Brix', 'Thiel', 'Kern', 'Voss', 'Gerlach',
  'Aslan', 'Reuter', 'Hinrichs', 'Lenz', 'Tas', 'Bode', 'Peters',
];

interface RoleFamily {
  readonly location: CityLocationId;
  readonly persona: PersonaId;
  readonly roles: readonly string[];
}

/** Ort, Persona und Rolle gehoeren zusammen: eine Wirtin steht nicht im Casino. */
const ROLE_FAMILIES: readonly RoleFamily[] = [
  {
    location: 'KIEZ', persona: 'STAMMGAST',
    roles: ['Aushilfe hinter dem Tresen', 'Kellnerin im Kiez', 'Spuelkraft'],
  },
  {
    location: 'MARKT', persona: 'BUSINESS',
    roles: ['Standhilfe am Markt', 'Kurierin der Marktgasse', 'Kassierer'],
  },
  {
    location: 'MARKT', persona: 'STREET',
    roles: ['Laeuferin zwischen den Staenden', 'Flohmarkt-Haendler', 'Zeitungsaustraeger'],
  },
  {
    location: 'CASINO', persona: 'HIGH_ROLLER',
    roles: ['Croupier', 'Saalaufsicht', 'Barkeeper im Casino'],
  },
  {
    location: 'KIEZ', persona: 'LUMPEN',
    roles: ['Gelegenheitsarbeiter', 'Pfaenderleher', 'Tuersteher auf Abruf'],
  },
];

const hash = (seed: number, index: number, salt: string): number => {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < salt.length; i += 1) h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
};

const pick = <T>(pool: readonly T[], h: number): T => pool[h % pool.length]!;

/** Zwei verschiedene Eigenschaften; die Auswahl ist seedfest, nicht zufaellig. */
function traitsAt(index: number, seed: number): readonly TraitId[] {
  const first = hash(seed, index, 'trait-a') % TRAITS.length;
  const step = 1 + (hash(seed, index, 'trait-b') % (TRAITS.length - 1));
  return [TRAITS[first]!.id, TRAITS[(first + step) % TRAITS.length]!.id];
}

/** Kennung einer Figur: die kuratierten behalten ihren Namen als Kennung. */
function npcIdAt(index: number): string {
  return CITY_NPCS[index]?.id ?? `npc_${index + 1}`;
}

/** Index aus einer Kennung; unbekannte Kennungen haben keinen Index. */
export function npcIndexById(npcId: string): number | null {
  const curated = CITY_NPCS.findIndex((entry) => entry.id === npcId);
  if (curated >= 0) return curated;
  const match = /^npc_(\d+)$/.exec(npcId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isSafeInteger(index) && index >= CITY_NPCS.length ? index : null;
}

/** Die Figur an dieser Stelle; kuratierte Figuren sind Index 0..2. */
export function rosterDefAt(index: number, seed = 0): CityNpcDef {
  const curated = CITY_NPCS[index];
  if (curated) return curated;
  // Der Ort haengt am Index, nicht am Seed: Schicht und Arbeitsort muessen
  // ueberall gleich herauskommen, auch wenn ein Aufruf den Seed nicht kennt.
  const family = ROLE_FAMILIES[index % ROLE_FAMILIES.length]!;
  const name = `${pick(FIRST_NAMES, hash(seed, index, 'first'))} ${pick(LAST_NAMES, hash(seed, index, 'last'))}`;
  return {
    id: npcIdAt(index),
    name,
    role: pick(family.roles, hash(seed, index, 'role')),
    location: family.location,
    persona: family.persona,
    charisma: 1 + (hash(seed, index, 'cha') % 10),
    intellect: 1 + (hash(seed, index, 'int') % 10),
    vice: hash(seed, index, 'vice') % 7,
    traits: traitsAt(index, seed),
  };
}

/** Figur zu einer Kennung; `null` nur fuer Kennungen, die kein Index ist. */
export function rosterDefById(npcId: string, seed = 0): CityNpcDef | null {
  const index = npcIndexById(npcId);
  return index === null ? null : rosterDefAt(index, seed);
}

/** Die ersten `count` Figuren; die Liste waechst, sie ist nicht fest. */
export function rosterDefs(count: number, seed = 0): readonly CityNpcDef[] {
  const size = Math.max(CITY_NPCS.length, Math.floor(count));
  return Array.from({ length: size }, (_, index) => rosterDefAt(index, seed));
}
