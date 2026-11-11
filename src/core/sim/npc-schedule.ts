/**
 * @module npc-schedule — Deterministische Tagesplaene und Absichts-Auswertung fuer NPCs
 */

import type { DayPlan, NpcIntent, NpcNeeds, NpcScheduleEntry } from './npc-types';
import { needsOverrideIntent } from './npc-needs';

export const STANDARD_WORKDAY_ENTRIES: readonly NpcScheduleEntry[] = [
  { startHour: 0, intent: 'SLEEP', targetBuildingId: 'apt_player' },
  { startHour: 6, intent: 'WAKE_UP', targetBuildingId: 'apt_player' },
  { startHour: 7, intent: 'EAT_HOME', targetBuildingId: 'apt_player' },
  { startHour: 8, intent: 'COMMUTE', targetBuildingId: 'bld_office_01' },
  { startHour: 9, intent: 'WORK', targetBuildingId: 'bld_office_01' },
  { startHour: 12, intent: 'EAT_OUT', targetBuildingId: 'bld_restaurant_01' },
  { startHour: 13, intent: 'WORK', targetBuildingId: 'bld_office_01' },
  { startHour: 17, intent: 'COMMUTE', targetBuildingId: 'bld_supermarket_01' },
  { startHour: 18, intent: 'SHOP', targetBuildingId: 'bld_supermarket_01' },
  { startHour: 19, intent: 'PUB', targetBuildingId: 'bld_pub_01' },
  { startHour: 22, intent: 'COMMUTE', targetBuildingId: 'apt_player' },
  { startHour: 23, intent: 'SLEEP', targetBuildingId: 'apt_player' },
];

export function createDayPlan(
  npcId: string,
  homeBuildingId: string = 'apt_player',
  workBuildingId: string = 'bld_office_01'
): DayPlan {
  const entries: NpcScheduleEntry[] = STANDARD_WORKDAY_ENTRIES.map((entry) => {
    if (entry.targetBuildingId === 'apt_player') {
      return { ...entry, targetBuildingId: homeBuildingId };
    }
    if (entry.targetBuildingId === 'bld_office_01') {
      return { ...entry, targetBuildingId: workBuildingId };
    }
    return entry;
  });

  return {
    npcId,
    entries,
  };
}

export function nextIntentForHour(plan: DayPlan, hour: number): NpcScheduleEntry | undefined {
  const normalizedHour = ((hour % 24) + 24) % 24;
  let activeEntry: NpcScheduleEntry | undefined = undefined;

  for (const entry of plan.entries) {
    if (entry.startHour <= normalizedHour) {
      if (!activeEntry || entry.startHour > activeEntry.startHour) {
        activeEntry = entry;
      }
    }
  }

  if (!activeEntry && plan.entries.length > 0) {
    activeEntry = plan.entries[plan.entries.length - 1];
  }

  return activeEntry;
}

export function resolveNpcIntent(
  needs: NpcNeeds,
  scheduledEntry: NpcScheduleEntry,
  hour: number
): NpcIntent {
  const overrideKind = needsOverrideIntent(needs);
  const effectiveKind = overrideKind ?? scheduledEntry.intent;

  return {
    kind: effectiveKind,
    targetBuildingId: scheduledEntry.targetBuildingId,
    startHour: hour,
    durationHours: 1,
    priority: overrideKind ? 9 : 5,
  };
}
