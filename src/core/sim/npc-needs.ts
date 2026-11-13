/**
 * @module npc-needs — Beduerfnis-Simulation und LOD-Klassifikation fuer autonome NPCs
 */

import type { NpcIntentKind, NpcNeeds, NpcLODLevel } from './npc-types';
import { clampNeed, driftNeed, needAtLeast, satisfyNeed } from './needs-core';

export const HUNGER_THRESHOLD_URGENT = 85;
export const THIRST_THRESHOLD_URGENT = 85;
export const FATIGUE_THRESHOLD_URGENT = 90;
export const SOCIAL_THRESHOLD_URGENT = 80;

export function createDefaultNeeds(custom?: Partial<NpcNeeds>): NpcNeeds {
  return {
    hunger: custom?.hunger ?? 20,
    thirst: custom?.thirst ?? 20,
    fatigue: custom?.fatigue ?? 10,
    social: custom?.social ?? 30,
    money: custom?.money ?? 5000,
    mood: custom?.mood ?? 75,
  };
}

export function tickNeeds(
  needs: NpcNeeds,
  currentIntent: NpcIntentKind,
  elapsedHours: number
): NpcNeeds {
  const hours = Math.max(0, elapsedHours);
  let hunger = needs.hunger;
  let thirst = needs.thirst;
  let fatigue = needs.fatigue;
  let social = needs.social;
  let mood = needs.mood;
  const money = needs.money;

  switch (currentIntent) {
    case 'SLEEP':
      fatigue = satisfyNeed(fatigue, hours * 15);
      hunger = driftNeed(hunger, hours * 3);
      thirst = driftNeed(thirst, hours * 2);
      mood = driftNeed(mood, hours * 2);
      break;
    case 'EAT_HOME':
    case 'EAT_OUT':
      hunger = satisfyNeed(hunger, hours * 40);
      thirst = satisfyNeed(thirst, hours * 45);
      mood = driftNeed(mood, hours * 5);
      break;
    case 'WORK':
      fatigue = driftNeed(fatigue, hours * 8);
      hunger = driftNeed(hunger, hours * 6);
      thirst = driftNeed(thirst, hours * 4);
      social = satisfyNeed(social, hours * 3);
      break;
    case 'PUB':
    case 'LEISURE':
    case 'VISIT_FRIEND':
      social = satisfyNeed(social, hours * 20);
      mood = driftNeed(mood, hours * 10);
      fatigue = driftNeed(fatigue, hours * 4);
      hunger = driftNeed(hunger, hours * 5);
      thirst = satisfyNeed(thirst, hours * 20);
      break;
    default:
      hunger = driftNeed(hunger, hours * 4);
      thirst = driftNeed(thirst, hours * 3);
      fatigue = driftNeed(fatigue, hours * 3);
      social = driftNeed(social, hours * 2);
      break;
  }

  return {
    hunger: clampNeed(hunger),
    thirst: clampNeed(thirst),
    fatigue: clampNeed(fatigue),
    social: clampNeed(social),
    money,
    mood: clampNeed(mood),
  };
}

export function needsOverrideIntent(needs: NpcNeeds): NpcIntentKind | null {
  if (needAtLeast(needs.fatigue, FATIGUE_THRESHOLD_URGENT)) {
    return 'SLEEP';
  }
  if (needAtLeast(needs.hunger, HUNGER_THRESHOLD_URGENT)) {
    return needs.money >= 500 ? 'EAT_OUT' : 'EAT_HOME';
  }
  if (needAtLeast(needs.thirst, THIRST_THRESHOLD_URGENT)) {
    return needs.money >= 500 ? 'PUB' : 'EAT_HOME';
  }
  if (needAtLeast(needs.social, SOCIAL_THRESHOLD_URGENT)) {
    return 'PUB';
  }
  return null;
}

export function computeLODLevel(
  distanceTiles: number,
  sameBuilding: boolean
): NpcLODLevel {
  if (sameBuilding || distanceTiles <= 15) {
    return 'ACTIVE';
  }
  if (distanceTiles <= 50) {
    return 'NEIGHBORHOOD';
  }
  if (distanceTiles <= 150) {
    return 'OFFSCREEN';
  }
  return 'ABSTRACT';
}
