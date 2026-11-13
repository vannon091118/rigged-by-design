/**
 * @module city-life — autonome Lebenssimulation der benannten Stadt-NPCs
 *
 * Jeder Bewohner der Liste ist keine Kulisse: Jede Stunde entscheidet seine
 * Tagesroutine zusammen mit Hunger, Durst, Muedigkeit, Sozialbedarf, Laune,
 * Traits, Attributen, Faehigkeiten, Beziehungen, Erinnerungen und Bargeld.
 * Die Beduerfnisse tragen ueber Tagesgrenzen, Save/Load und den Wechsel
 * zwischen Stadt und eigenem Betrieb hinweg; der Trace bleibt nachvollziehbar.
 *
 * Die Schleife fragt keine feste Tabelle: Figur und Schicht kommen aus der
 * Kennung (`city-npc-roster`, `city-npc-shift`), damit sie mit der Stadt waechst.
 */
import { ensureCityVisitor, type CityNpcDef } from './city-npcs';
import { rosterDefById } from './city-npc-roster';
import { buildingOfPlace, placeOfBuilding, slotOf } from './city-npc-shift';
import type {
  CityLifeDecision, CityLifeState, CityResidentState,
} from './city-life-types';
import { ensureCityLife } from './city-life-state';
import { hourOfTick } from './clock';
import { clamp } from './num';
import { createDayPlan, nextIntentForHour } from './npc-schedule';
import { cityMap, startTravel } from './city-life-movement';
import { applyCityDecision } from './city-life-apply';
import { decideCityLife } from './city-life-decision';
import type { TraitState } from './city-types';
import type { WorldState } from './types';

export {
  createCityLifeState,
  ensureCityLife,
  ensureCityPopulation,
  growCityPopulation,
  normalizeCityLife,
} from './city-life-state';
export { CITY_POPULATION_DEFAULT, rosterDefAt, rosterDefs } from './city-npc-roster';

const HOME_BUILDING = 'bld_player_home';

/** Figur zu einer Kennung; ein Save ohne Besetzung hat keine Figur. */
function defFor(npcId: string, seed: number): CityNpcDef | null {
  return rosterDefById(npcId, seed);
}

function elapsedHours(record: CityResidentState, day: number, hour: number): number {
  const elapsed = (day - record.lastDay) * 24 + (hour - record.lastHour);
  return Math.max(1, Math.min(24, elapsed));
}

function traitsFor(world: WorldState, def: CityNpcDef | null): readonly TraitState[] {
  return def ? ensureCityVisitor(world, def).traits ?? [] : [];
}

function applyRelationshipDelta(
  residents: CityResidentState[], actorId: string, targetId: string, delta: number,
): void {
  const index = residents.findIndex((resident) => resident.npcId === targetId);
  if (index < 0) return;
  const target = residents[index]!;
  const value = clamp((target.relationships[actorId] ?? 0) + delta, -100, 100);
  residents[index] = { ...target, relationships: { ...target.relationships, [actorId]: value } };
}

interface TickResult {
  readonly resident: CityResidentState;
  readonly decision: CityLifeDecision | null;
  readonly relationshipTarget: string | null;
  readonly relationshipDelta: number;
}

/**
 * Ein Stundenwechsel bewegt alle Bewohner der Liste, egal wie viele es sind.
 * Der Aufruf ist idempotent: innerhalb derselben Stunde bleiben Standort und
 * Beduerfnisse unveraendert.
 */
export function tickCityLife(world: WorldState): void {
  const life = ensureCityLife(world);
  const hour = hourOfTick(world.tick);
  const seed = life.seed ?? 0;
  let decisionSeq = life.decisionSeq ?? 0;
  let memorySeq = life.memorySeq ?? 1;
  const changed = life.residents.map((record): TickResult => {
    if (record.lastDay === world.day && record.lastHour === hour) {
      return { resident: record, decision: null, relationshipTarget: null, relationshipDelta: 0 };
    }
    const def = defFor(record.npcId, seed);
    const slot = slotOf(record.npcId);
    const workplace = def ? buildingOfPlace(def.location) : HOME_BUILDING;
    const plan = createDayPlan(record.npcId, HOME_BUILDING, slot?.buildingId ?? workplace, slot ?? undefined);
    const scheduled = nextIntentForHour(plan, hour);
    if (!scheduled) return { resident: record, decision: null, relationshipTarget: null, relationshipDelta: 0 };
    // Das konkrete Ziel des Plans gehoert in die Entscheidung: sonst routet
    // COMMUTE immer zum Arbeitsplatz, auch auf dem Heimweg nach Schichtende.
    const scheduledPlace = placeOfBuilding(scheduled.targetBuildingId);
    const input = {
      resident: record,
      scheduled: scheduled.intent,
      scheduledPlace,
      workplace: def?.location ?? 'MARKT',
      hour,
      day: world.day,
      tick: world.tick,
      peers: life.residents,
      traits: traitsFor(world, def),
      seed,
    };
    const decisionPlan = decideCityLife(input);
    // Wirkung erst am Ort: Was eine Reise braucht, bucht nur die Zeitdauer;
    // Geld, Faehigkeit und Kontakt folgen in `tickCityMovement` bei Ankunft.
    const needsTravel = decisionPlan.choice.location !== record.location;
    const applied = applyCityDecision({
      input,
      plan: decisionPlan,
      decisionId: decisionSeq + 1,
      elapsedHours: elapsedHours(record, world.day, hour),
      nextMemoryId: memorySeq,
      settled: !needsTravel,
    });
    decisionSeq += 1;
    memorySeq = applied.nextMemoryId;
    // Ein Ortswechsel ist ein Weg, kein Sprung: Der Ort wechselt erst, wenn der
    // Bewohner an der Tür steht. Ohne Weg bleibt alles, wie es ist.
    // `applyCityDecision` hat den Ort schon gesetzt; fuer den Weg zaehlt der
    // Ort davor. Erst der Weg macht daraus einen Aufbruch statt eines Sprungs.
    const moved = applied.resident;
    const target = applied.decision.location;
    let resident = { ...moved, lastHour: hour, lastDay: world.day };
    if (target !== record.location) {
      // Ein neues Ziel ersetzt eine alte Route; ohne Weg bleibt der Ort alt.
      const start = startTravel(moved.position, cityMap(world), target);
      if (start.travel) resident = { ...resident, location: record.location, travel: start.travel };
      else if (start.here) resident = { ...resident, location: target };
      else resident = { ...resident, location: record.location };
    } else if (record.travel && record.travel.to !== target) {
      // Ziel ist der aktuelle Ort, die laufende Route fuehrt woandershin: Sie
      // widerspricht dem Intent und wird abgebrochen, statt den NPC zum
      // veralteten Ziel zu tragen. Fuehrt sie ohnehin zum selben Ort, laeuft
      // sie weiter — sonst bliebe jeder Weg nach einer Stunde stehen.
      resident = { ...resident, travel: null };
    }
    return {
      resident,
      decision: applied.decision,
      relationshipTarget: applied.relationshipTarget,
      relationshipDelta: applied.relationshipDelta,
    };
  });
  const residents = changed.map((entry) => entry.resident);
  for (const entry of changed) {
    if (entry.relationshipTarget) {
      applyRelationshipDelta(residents, entry.resident.npcId, entry.relationshipTarget, entry.relationshipDelta);
    }
  }
  const decisions = new Map((life.lastDecisions ?? []).map((decision) => [decision.npcId, decision]));
  for (const entry of changed) {
    if (entry.decision) decisions.set(entry.decision.npcId, entry.decision);
  }
  const freshDecisions = [...decisions.values()];
  const next: CityLifeState = {
    ...life,
    residents,
    decisionSeq,
    memorySeq,
    lastDecisions: freshDecisions,
  };
  world.cityLife = next;
}

export { cityLifeView } from './city-life-view';
