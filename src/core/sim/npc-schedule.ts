/**
 * @module npc-schedule — Deterministische Tagesplaene und Absichts-Auswertung fuer NPCs
 */

import type { DayPlan, NpcIntent, NpcNeeds, NpcScheduleEntry } from './npc-types';
import { needsOverrideIntent } from './npc-needs';
import { hourOfDay } from './clock';
import { clamp } from './num';

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

/**
 * Tagesplan um eine echte Schicht herum: Aufstehen zwei Stunden vorher,
 * Fruehstueck, eine Pause mitten in der Schicht, danach der Weg nach Hause und
 * der Abend. Die Zeiten stehen im Slot, nicht im Plan.
 */
function shiftEntries(
  homeBuildingId: string, workBuildingId: string, shift: { readonly from: number; readonly to: number },
): NpcScheduleEntry[] {
  const from = hourOfDay(Math.floor(shift.from));
  const to = clamp(Math.floor(shift.to), from, 24);
  const wake = (from - 2 + 24) % 24;
  const entries: NpcScheduleEntry[] = [
    { startHour: 0, intent: 'SLEEP', targetBuildingId: homeBuildingId },
  ];
  const breakfast = (wake + 1) % 24;
  if (wake > 0) {
    entries.push({ startHour: wake, intent: 'WAKE_UP', targetBuildingId: homeBuildingId });
    if (breakfast > wake) entries.push({ startHour: breakfast, intent: 'EAT_HOME', targetBuildingId: homeBuildingId });
  }
  if (from - 1 > breakfast) entries.push({ startHour: from - 1, intent: 'COMMUTE', targetBuildingId: workBuildingId });
  entries.push({ startHour: from, intent: 'WORK', targetBuildingId: workBuildingId });
  const pause = from + 4;
  if (pause < to - 1) {
    entries.push({ startHour: pause, intent: 'EAT_OUT', targetBuildingId: workBuildingId });
    entries.push({ startHour: pause + 1, intent: 'WORK', targetBuildingId: workBuildingId });
  }
  if (to < 24) {
    entries.push({ startHour: to, intent: 'COMMUTE', targetBuildingId: homeBuildingId });
    const shop = to + 1;
    if (shop < 22) entries.push({ startHour: shop, intent: 'SHOP', targetBuildingId: 'bld_supermarket_01' });
    const pub = to + 2;
    if (pub < 23) entries.push({ startHour: pub, intent: 'PUB', targetBuildingId: 'bld_pub_01' });
    const bed = clamp(to + 3, 21, 23);
    if (bed < 24) entries.push({ startHour: bed, intent: 'SLEEP', targetBuildingId: homeBuildingId });
  }
  return entries.sort((first, second) => first.startHour - second.startHour);
}

export function createDayPlan(
  npcId: string,
  homeBuildingId: string = 'apt_player',
  workBuildingId: string = 'bld_office_01',
  shift?: { readonly from: number; readonly to: number }
): DayPlan {
  if (shift) return { npcId, entries: shiftEntries(homeBuildingId, workBuildingId, shift) };
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

/**
 * Tagesplan ohne Arbeit: Wer keine Stelle hat, geht nicht zur Arbeit und
 * verdient kein Geld (#519). Der Tag bleibt trotzdem ein Tag.
 */
export function createIdleDayPlan(npcId: string, homeBuildingId: string): DayPlan {
  return {
    npcId,
    entries: [
      { startHour: 0, intent: 'SLEEP', targetBuildingId: homeBuildingId },
      { startHour: 7, intent: 'WAKE_UP', targetBuildingId: homeBuildingId },
      { startHour: 8, intent: 'EAT_HOME', targetBuildingId: homeBuildingId },
      { startHour: 11, intent: 'SHOP', targetBuildingId: 'bld_corner_shop' },
      { startHour: 13, intent: 'EAT_OUT', targetBuildingId: 'bld_kiez_pub' },
      { startHour: 19, intent: 'PUB', targetBuildingId: 'bld_kiez_pub' },
      { startHour: 22, intent: 'COMMUTE', targetBuildingId: homeBuildingId },
      { startHour: 23, intent: 'SLEEP', targetBuildingId: homeBuildingId },
    ],
  };
}

export function nextIntentForHour(plan: DayPlan, hour: number): NpcScheduleEntry | undefined {
  const normalizedHour = hourOfDay(hour);
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
