/**
 * @module city-life-effects — unmittelbare Wirkung eines Intents
 *
 * Der Tagesplan und der Score waehlen nur; erst diese Effekte veraendern
 * Beduerfnisse, Bargeld und Faehigkeiten. Die Werte werden anschliessend
 * geklemmt und in `city-life-apply.ts` mit Beziehung und Erinnerung verbunden.
 */
import { tickNeeds } from './npc-needs';
import type { CityResidentState } from './city-life-types';
import type { NpcIntentKind, NpcNeeds } from './npc-types';

const clampNeed = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export interface CityEffects {
  readonly money: number;
  readonly hunger: number;
  readonly thirst: number;
  readonly fatigue: number;
  readonly social: number;
  readonly mood: number;
  readonly cooking: number;
  readonly work: number;
  readonly socialSkill: number;
}

export function applyIntentEffects(
  before: NpcNeeds, intent: NpcIntentKind, elapsedHours: number,
  skills: CityResidentState['skills'],
): CityEffects {
  const after = tickNeeds(before, intent, elapsedHours);
  let money = before.money;
  let mood = after.mood;
  let social = after.social;
  let hunger = after.hunger;
  let thirst = after.thirst;
  let fatigue = after.fatigue;
  let cooking = skills.cooking;
  let work = skills.work;
  let socialSkill = skills.social;

  switch (intent) {
    case 'EAT_HOME':
      money -= 120;
      cooking = Math.min(100, cooking + 2);
      hunger = clampNeed(hunger - Math.min(8, cooking / 12));
      mood = clampNeed(mood + 2);
      break;
    case 'EAT_OUT':
      money -= 800;
      cooking = Math.min(100, cooking + 1);
      social = clampNeed(social + 3);
      break;
    case 'PUB':
      money -= 450;
      social = clampNeed(social - 5);
      mood = clampNeed(mood - 6);
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'VISIT_FRIEND':
      social = clampNeed(social - 25);
      mood = clampNeed(mood - 6);
      fatigue = clampNeed(fatigue + 2);
      hunger = clampNeed(hunger + 3);
      thirst = clampNeed(thirst + 4);
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'WORK':
      money += 350;
      work = Math.min(100, work + 2);
      mood = clampNeed(mood - 5);
      break;
    case 'LEISURE':
      money -= 120;
      mood = clampNeed(mood - 6);
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'SHOP':
      money -= 250;
      cooking = Math.min(100, cooking + 1);
      break;
  }
  return { money, hunger, thirst, fatigue, social, mood, cooking, work, socialSkill };
}
