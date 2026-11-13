/**
 * @module city-life-view — Anzeige des Stadtlebens
 *
 * Die Sicht rechnet nichts nach: Ort, Intent, Bedürfnisse und Traits kommen aus
 * dem gespeicherten Bewohnerzustand. Die Labels sind Übersetzung, keine zweite
 * Wahrheit; ein neuer Intent ohne Label ist ein Typfehler, kein leerer Text.
 */
import { ensureCityLife } from './city-life-state';
import { explainTraits } from './city-traits';
import type { CityLifePlace, CityResidentView } from './city-life-types';
import type { NpcIntentKind } from './npc-types';
import type { WorldState } from './types';

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

export function cityLifeView(world: WorldState): readonly CityResidentView[] {
  const life = ensureCityLife(world);
  return life.residents.map((resident) => {
    // Identitaet ist die Kennung, nicht der Name: Ein Namensvetter im
    // Gaestepool hat seine eigenen Traits und Beziehungen.
    const visitor = world.visitors.find((entry) => entry.id === resident.visitorId);
    return {
      npcId: resident.npcId,
      name: resident.name,
      role: resident.role,
      location: resident.location,
      locationLabel: PLACE_LABELS[resident.location],
      travelTo: resident.travel ? PLACE_LABELS[resident.travel.to] : null,
      position: resident.position,
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
