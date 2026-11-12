/**
 * @module city-life — autonome Lebenssimulation der benannten Stadt-NPCs
 *
 * Rita, Boris und Mira sind keine Kulisse: Jede Stunde entscheidet ihre
 * Tagesroutine zusammen mit Hunger, Durst, Muedigkeit und Sozialbedarf, wo sie
 * sind und was sie tun. Die Beduerfnisse tragen ueber Tagesgrenzen, Save/Load
 * und den Wechsel zwischen Stadt und eigenem Betrieb hinweg.
 */
import { CITY_NPCS, type CityNpcDef } from './city-npcs';
import type { CityLifePlace, CityResidentState, CityResidentView } from './city-life-types';
import { ensureCityLife, hourOf } from './city-life-state';
import { tickNeeds } from './npc-needs';
import { createDayPlan, nextIntentForHour, resolveNpcIntent } from './npc-schedule';
import type { NpcIntentKind } from './npc-types';
import type { WorldState } from './types';
import { explainTraits } from './city-traits';

export {
  createCityLifeState,
  ensureCityLife,
  hourOf,
  normalizeCityLife,
  TICKS_PER_HOUR,
} from './city-life-state';

const HOME_BUILDING = 'bld_player_home';

const INTENT_LABELS: Readonly<Record<NpcIntentKind, string>> = {
  SLEEP: 'schläft',
  WAKE_UP: 'wacht auf',
  EAT_HOME: 'isst zu Hause',
  EAT_OUT: 'isst auswärts',
  WORK: 'arbeitet',
  LEISURE: 'Freizeit',
  VISIT_FRIEND: 'besucht jemanden',
  SHOP: 'kauft ein',
  PUB: 'in der Kneipe',
  COMMUTE: 'unterwegs',
  IDLE: 'untätig',
};

const PLACE_LABELS: Readonly<Record<CityLifePlace, string>> = {
  HOME: 'Wohnung',
  KIEZ: 'Kiez',
  MARKT: 'Markt',
  CASINO: 'Casino',
};

function workBuildingFor(def: CityNpcDef): string {
  return def.location === 'KIEZ' ? 'bld_kiez_pub' : 'bld_corner_shop';
}

function placeForIntent(intent: NpcIntentKind, def: CityNpcDef): CityLifePlace {
  switch (intent) {
    case 'WORK':
    case 'COMMUTE':
      return def.location;
    case 'PUB':
    case 'LEISURE':
    case 'VISIT_FRIEND':
      return 'KIEZ';
    case 'EAT_OUT':
    case 'SHOP':
      return def.location;
    default:
      return 'HOME';
  }
}

function elapsedHours(record: CityResidentState, day: number, hour: number): number {
  const elapsed = (day - record.lastDay) * 24 + (hour - record.lastHour);
  return Math.max(1, Math.min(24, elapsed));
}

/**
 * Ein Stundenwechsel bewegt alle drei Bewohner. Der Aufruf ist idempotent:
 * innerhalb derselben Stunde bleiben Standort und Beduerfnisse unveraendert.
 */
export function tickCityLife(world: WorldState): void {
  const life = ensureCityLife(world);
  const hour = hourOf(world.tick);
  const next = life.residents.map((record) => {
    if (record.lastDay === world.day && record.lastHour === hour) return record;
    const def = CITY_NPCS.find((entry) => entry.id === record.npcId);
    if (!def) return record;
    const plan = createDayPlan(def.id, HOME_BUILDING, workBuildingFor(def));
    const scheduled = nextIntentForHour(plan, hour);
    if (!scheduled) return record;
    const resolved = resolveNpcIntent(record.needs, scheduled, hour);
    const needs = tickNeeds(record.needs, resolved.kind, elapsedHours(record, world.day, hour));
    return {
      ...record,
      intent: resolved.kind,
      location: placeForIntent(resolved.kind, def),
      needs,
      lastHour: hour,
      lastDay: world.day,
    };
  });
  world.cityLife = { residents: next };
}

export function cityLifeView(world: WorldState): readonly CityResidentView[] {
  const life = ensureCityLife(world);
  return life.residents.map((resident) => {
    const visitor = world.visitors.find((entry) => entry.name === resident.name);
    return {
      npcId: resident.npcId,
      name: resident.name,
      role: resident.role,
      location: resident.location,
      locationLabel: PLACE_LABELS[resident.location],
      intent: resident.intent,
      intentLabel: INTENT_LABELS[resident.intent],
      hunger: resident.needs.hunger,
      thirst: resident.needs.thirst,
      fatigue: resident.needs.fatigue,
      social: resident.needs.social,
      mood: resident.needs.mood,
      traits: visitor?.traits
        ? explainTraits(visitor.traits).split(', ').filter((label) => label.length > 0)
        : [],
    };
  });
}
