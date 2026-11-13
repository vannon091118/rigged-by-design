/**
 * @module city-life — autonome Lebenssimulation der benannten Stadt-NPCs
 *
 * Rita, Boris und Mira sind keine Kulisse: Jede Stunde entscheidet ihre
 * Tagesroutine zusammen mit Hunger, Durst, Muedigkeit, Sozialbedarf, Laune,
 * Traits, Attributen, Faehigkeiten, Beziehungen, Erinnerungen und Bargeld.
 * Die Beduerfnisse tragen ueber Tagesgrenzen, Save/Load und den Wechsel
 * zwischen Stadt und eigenem Betrieb hinweg; der Trace bleibt nachvollziehbar.
 */
import { CITY_NPCS, ensureCityVisitor, type CityNpcDef } from './city-npcs';
import type {
  CityLifeDecision, CityLifeState, CityResidentState,
} from './city-life-types';
import { ensureCityLife, hourOf } from './city-life-state';
import { createDayPlan, nextIntentForHour } from './npc-schedule';
import { slotOf } from './city-life-venues';
import { cityMap, startTravel } from './city-life-movement';
import { applyCityDecision } from './city-life-apply';
import { decideCityLife } from './city-life-decision';
import type { TraitState } from './city-types';
import type { WorldState } from './types';

export {
  createCityLifeState,
  ensureCityLife,
  hourOf,
  normalizeCityLife,
  TICKS_PER_HOUR,
} from './city-life-state';

const HOME_BUILDING = 'bld_player_home';

function workBuildingFor(def: CityNpcDef): string {
  return def.location === 'KIEZ' ? 'bld_kiez_pub' : 'bld_corner_shop';
}

function elapsedHours(record: CityResidentState, day: number, hour: number): number {
  const elapsed = (day - record.lastDay) * 24 + (hour - record.lastHour);
  return Math.max(1, Math.min(24, elapsed));
}

function traitsFor(world: WorldState, def: CityNpcDef): readonly TraitState[] {
  return ensureCityVisitor(world, def).traits ?? [];
}

function applyRelationshipDelta(
  residents: CityResidentState[], actorId: string, targetId: string, delta: number,
): void {
  const index = residents.findIndex((resident) => resident.npcId === targetId);
  if (index < 0) return;
  const target = residents[index]!;
  const value = Math.max(-100, Math.min(100, (target.relationships[actorId] ?? 0) + delta));
  residents[index] = { ...target, relationships: { ...target.relationships, [actorId]: value } };
}

interface TickResult {
  readonly resident: CityResidentState;
  readonly decision: CityLifeDecision | null;
  readonly relationshipTarget: string | null;
  readonly relationshipDelta: number;
}

/**
 * Ein Stundenwechsel bewegt alle drei Bewohner. Der Aufruf ist idempotent:
 * innerhalb derselben Stunde bleiben Standort und Beduerfnisse unveraendert.
 */
export function tickCityLife(world: WorldState): void {
  const life = ensureCityLife(world);
  const hour = hourOf(world.tick);
  const seed = life.seed ?? 0;
  let decisionSeq = life.decisionSeq ?? 0;
  let memorySeq = life.memorySeq ?? 1;
  const changed = life.residents.map((record): TickResult => {
    if (record.lastDay === world.day && record.lastHour === hour) {
      return { resident: record, decision: null, relationshipTarget: null, relationshipDelta: 0 };
    }
    const def = CITY_NPCS.find((entry) => entry.id === record.npcId);
    if (!def) return { resident: record, decision: null, relationshipTarget: null, relationshipDelta: 0 };
    const plan = createDayPlan(def.id, HOME_BUILDING, workBuildingFor(def), slotOf(def.id) ?? undefined);
    const scheduled = nextIntentForHour(plan, hour);
    if (!scheduled) return { resident: record, decision: null, relationshipTarget: null, relationshipDelta: 0 };
    const input = {
      resident: record,
      scheduled: scheduled.intent,
      workplace: def.location,
      hour,
      day: world.day,
      tick: world.tick,
      peers: life.residents,
      traits: traitsFor(world, def),
      seed,
    };
    const decisionPlan = decideCityLife(input);
    const applied = applyCityDecision({
      input,
      plan: decisionPlan,
      decisionId: decisionSeq + 1,
      elapsedHours: elapsedHours(record, world.day, hour),
      nextMemoryId: memorySeq,
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
      const start = startTravel(moved.position, cityMap(world), target);
      if (start.travel) resident = { ...resident, location: record.location, travel: start.travel };
      else if (start.here) resident = { ...resident, location: target };
      else resident = { ...resident, location: record.location };
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
