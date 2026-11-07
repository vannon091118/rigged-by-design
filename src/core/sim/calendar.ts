/**
 * Calendar — Derived date/time from WorldTime.
 * No independent mutable clock; everything derives from WorldTime.
 */

import type { WorldTime } from "./worldtime";
import { TICKS_PER_DAY } from "./worldtime";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
export const DAYS_PER_SEASON = 30;
export const DAYS_PER_YEAR = 120; // 4 seasons × 30 days

export interface CalendarDate {
  readonly day: number;
  readonly weekday: string;
  readonly season: string;
  readonly seasonDay: number; // 0..29
  readonly year: number;
  readonly timeOfDay: string;
}

export function calendarFromWorldTime(time: WorldTime): CalendarDate {
  const totalMinutes = Math.floor((time.tickInDay * 520) / 60000);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const timeOfDay = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

  const year = Math.floor(time.day / DAYS_PER_YEAR);
  const dayInYear = time.day % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayInYear / DAYS_PER_SEASON);
  const seasonDay = dayInYear % DAYS_PER_SEASON;
  const weekday = WEEKDAYS[time.day % WEEKDAYS.length];
  const season = SEASONS[seasonIndex];

  return {
    day: time.day,
    weekday,
    season,
    seasonDay,
    year,
    timeOfDay,
  };
}

export function isWeekend(time: WorldTime): boolean {
  const cal = calendarFromWorldTime(time);
  return cal.weekday === "Sat" || cal.weekday === "Sun";
}