/**
 * @module city-life-create — Startzustand und Wachstum der Bewohnerschaft
 *
 * Ein Bewohner entsteht aus seiner Figur in der Besetzung (`city-npc-roster`):
 * Name, Rolle, Attribute und Eigenschaften kommen von dort, die Beduerfnisse
 * streuen seedfest um einen Startwert. Die drei kuratierten Figuren behalten
 * ihre kuratierten Startwerte; jede weitere Figur bekommt dieselben Rechte mit
 * neutralem Start. `ensureCityPopulation` haengt weitere an, ohne bestehende
 * anzufassen — Wachstum ist eine Ergaenzung, kein Neuaufbau.
 */
import { CITY_NPCS } from './city-npcs';
import type { CityLifeState, CityResidentState } from './city-life-types';
import { rosterDefAt, CITY_POPULATION_DEFAULT } from './city-npc-roster';
import { createDefaultNeeds } from './npc-needs';
import { clampNeedValue } from './needs-core';
import { defaultSkills, seedOffset } from './city-life-normalize';
import { PLAYER_HOME_BUILDING, SHARED_HOUSEHOLD_ID } from './city-households';
import type { NpcNeeds } from './npc-types';

const INITIAL_NEEDS: Readonly<Record<string, Partial<NpcNeeds>>> = {
  rita: { hunger: 34, thirst: 30, fatigue: 18, social: 48, money: 8200, mood: 72 },
  boris: { hunger: 24, thirst: 72, fatigue: 14, social: 28, money: 12400, mood: 64 },
  mira: { hunger: 42, thirst: 38, fatigue: 26, social: 62, money: 6100, mood: 76 },
};

/** Startkasse neuer Bewohner: genug fuer den ersten Tag, nicht fuer Casino. */
const START_MONEY = 2600;

/** Bewohner an einer Stelle der Besetzung. */
function residentAt(index: number, seed: number): CityResidentState {
  const def = rosterDefAt(index, seed);
  const base = createDefaultNeeds({ money: START_MONEY, ...INITIAL_NEEDS[def.id] });
  return {
    npcId: def.id,
    visitorId: null,
    name: def.name,
    role: def.role,
    location: 'HOME',
    // Die Adresse wird beim ersten `ensureCityLife` gegen die echten
    // Wohngebaeude aufgeloest; ohne Wohnhaus bleibt der geteilte Ausweichort.
    homeBuildingId: PLAYER_HOME_BUILDING,
    householdId: SHARED_HOUSEHOLD_ID,
    position: { x: 8, y: 12 },
    travel: null,
    intent: 'SLEEP',
    needs: {
      ...base,
      hunger: clampNeedValue(base.hunger + seedOffset(seed, def.id, 'hunger')),
      thirst: clampNeedValue(base.thirst + seedOffset(seed, def.id, 'thirst')),
      fatigue: clampNeedValue(base.fatigue + seedOffset(seed, def.id, 'fatigue')),
      social: clampNeedValue(base.social + seedOffset(seed, def.id, 'social')),
    },
    attributes: { charisma: def.charisma, intellect: def.intellect },
    skills: defaultSkills(),
    relationships: {},
    memories: [],
    lastHour: 0,
    lastDay: 0,
  };
}

/**
 * Frischer Zustand mit `population` Bewohnern. Weniger als die kuratierten drei
 * gibt es nicht: Sie sind der Anfang der Besetzung, keine Obergrenze.
 */
export function createCityLifeState(
  seed = 0, population = CITY_POPULATION_DEFAULT,
): CityLifeState {
  const size = Math.max(CITY_NPCS.length, Math.floor(population));
  return {
    residents: Array.from({ length: size }, (_, index) => residentAt(index, seed)),
    seed,
    decisionSeq: 0,
    memorySeq: 1,
    lastDecisions: [],
  };
}

/**
 * Ergaenzt die Stadt um Bewohner bis zur Zielgroesse. Vorhandene bleiben
 * unberuehrt (gleiche Objekte), neue starten zu Hause. Ohne Zuwachs kommt
 * derselbe Zustand zurueck, kein neues Objekt.
 */
export function growCityPopulation(life: CityLifeState, target: number): CityLifeState {
  const size = Math.max(CITY_NPCS.length, Math.floor(target));
  if (life.residents.length >= size) return life;
  const seed = life.seed ?? 0;
  const known = new Set(life.residents.map((resident) => resident.npcId));
  const added: CityResidentState[] = [];
  for (let index = 0; life.residents.length + added.length < size; index += 1) {
    const resident = residentAt(index, seed);
    if (known.has(resident.npcId)) continue;
    known.add(resident.npcId);
    added.push(resident);
  }
  return { ...life, residents: [...life.residents, ...added] };
}
