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
import { clampNeed, driftNeed, satisfyNeed } from './needs-core';

interface CityEffects {
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

/**
 * Nur das Verstreichen der Zeit: Beduerfnisse driften mit dem Intent, aber
 * Geld, Faehigkeiten und soziale Wirkung bleiben aus. Das ist der Anteil, der
 * auch waehrend einer Reise gilt — ortsgebundene Wirkung entsteht erst am Ziel.
 */
export function applyDrift(
  before: NpcNeeds, intent: NpcIntentKind, elapsedHours: number,
): CityEffects {
  const after = tickNeeds(before, intent, elapsedHours);
  return {
    money: before.money,
    hunger: after.hunger, thirst: after.thirst, fatigue: after.fatigue,
    social: after.social, mood: after.mood,
    cooking: 0, work: 0, socialSkill: 0,
  };
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
      hunger = clampNeed(satisfyNeed(hunger, Math.min(8, cooking / 12)));
      mood = clampNeed(driftNeed(mood, 2));
      break;
    case 'EAT_OUT':
      money -= 800;
      cooking = Math.min(100, cooking + 1);
      social = clampNeed(driftNeed(social, 3));
      break;
    case 'PUB':
      money -= 450;
      social = clampNeed(satisfyNeed(social, 5));
      mood = clampNeed(satisfyNeed(mood, 6));
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'VISIT_FRIEND':
      social = clampNeed(satisfyNeed(social, 25));
      mood = clampNeed(satisfyNeed(mood, 6));
      fatigue = clampNeed(driftNeed(fatigue, 2));
      hunger = clampNeed(driftNeed(hunger, 3));
      thirst = clampNeed(driftNeed(thirst, 4));
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'WORK':
      money += 350;
      work = Math.min(100, work + 2);
      mood = clampNeed(satisfyNeed(mood, 5));
      break;
    case 'LEISURE':
      money -= 120;
      mood = clampNeed(satisfyNeed(mood, 6));
      socialSkill = Math.min(100, socialSkill + 1);
      break;
    case 'SHOP':
      money -= 250;
      cooking = Math.min(100, cooking + 1);
      break;
  }
  return { money, hunger, thirst, fatigue, social, mood, cooking, work, socialSkill };
}
