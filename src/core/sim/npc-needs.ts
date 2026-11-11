/**
 * @module npc-needs — Beduerfnis-Simulation und LOD-Klassifikation fuer autonome NPCs
 */

import type { NpcIntentKind, NpcNeeds, NpcLODLevel } from './npc-types';

export const HUNGER_THRESHOLD_URGENT = 85;
export const FATIGUE_THRESHOLD_URGENT = 90;
export const SOCIAL_THRESHOLD_URGENT = 80;

export function createDefaultNeeds(custom?: Partial<NpcNeeds>): NpcNeeds {
  return {
    hunger: custom?.hunger ?? 20,
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
  let fatigue = needs.fatigue;
  let social = needs.social;
  let mood = needs.mood;
  const money = needs.money;

  switch (currentIntent) {
    case 'SLEEP':
      fatigue = Math.max(0, fatigue - hours * 15);
      hunger = Math.min(100, hunger + hours * 3);
      mood = Math.min(100, mood + hours * 2);
      break;
    case 'EAT_HOME':
    case 'EAT_OUT':
      hunger = Math.max(0, hunger - hours * 40);
      mood = Math.min(100, mood + hours * 5);
      break;
    case 'WORK':
      fatigue = Math.min(100, fatigue + hours * 8);
      hunger = Math.min(100, hunger + hours * 6);
      social = Math.max(0, social - hours * 3);
      break;
    case 'PUB':
    case 'LEISURE':
    case 'VISIT_FRIEND':
      social = Math.max(0, social - hours * 20);
      mood = Math.min(100, mood + hours * 10);
      fatigue = Math.min(100, fatigue + hours * 4);
      hunger = Math.min(100, hunger + hours * 5);
      break;
    default:
      hunger = Math.min(100, hunger + hours * 4);
      fatigue = Math.min(100, fatigue + hours * 3);
      social = Math.min(100, social + hours * 2);
      break;
  }

  return {
    hunger: Math.round(hunger),
    fatigue: Math.round(fatigue),
    social: Math.round(social),
    money,
    mood: Math.max(0, Math.min(100, Math.round(mood))),
  };
}

export function needsOverrideIntent(needs: NpcNeeds): NpcIntentKind | null {
  if (needs.fatigue >= FATIGUE_THRESHOLD_URGENT) {
    return 'SLEEP';
  }
  if (needs.hunger >= HUNGER_THRESHOLD_URGENT) {
    return needs.money >= 500 ? 'EAT_OUT' : 'EAT_HOME';
  }
  if (needs.social >= SOCIAL_THRESHOLD_URGENT) {
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
