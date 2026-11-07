/**
 * WorldTime — Single authoritative deterministic time source.
 * Phase 1.2: Integer-tick based, separated from Host Pacing / Wall Clock / Presentation Clock.
 */

export const TICK_MS = 520;
export const TICKS_PER_DAY = 600;
export const MS_PER_DAY = TICK_MS * TICKS_PER_DAY; // 312000 ms

export interface WorldTime {
  readonly tick: number;        // absolute tick since world start (Integer)
  readonly day: number;         // absolute day since world start
  readonly tickInDay: number;   // tick within current day (0 .. TICKS_PER_DAY-1)
  readonly ms: number;          // wall-clock ms equivalent (debug only, not authoritative)
}

export function createWorldTime(initialTick = 0): WorldTime {
  return {
    tick: initialTick,
    day: Math.floor(initialTick / TICKS_PER_DAY),
    tickInDay: Math.floor(initialTick % TICKS_PER_DAY),
    ms: initialTick * TICK_MS,
  };
}

export function advanceTick(time: WorldTime, steps = 1): WorldTime {
  const nextTick = time.tick + steps;
  return {
    tick: nextTick,
    day: Math.floor(nextTick / TICKS_PER_DAY),
    tickInDay: Math.floor(nextTick % TICKS_PER_DAY),
    ms: nextTick * TICK_MS,
  };
}

export function ticksFromDayStart(time: WorldTime): number {
  return time.tickInDay;
}

export function ticksToDayStart(time: WorldTime): number {
  return time.tick - time.tickInDay;
}

export function isSameDay(a: WorldTime, b: WorldTime): boolean {
  return a.day === b.day;
}

export function ticksToMs(ticks: number): number {
  return ticks * TICK_MS;
}

export function msToTicks(ms: number): number {
  return Math.floor(ms / TICK_MS);
}

export function timeOfDayString(time: WorldTime): string {
  const totalMinutes = Math.floor((time.tickInDay * TICK_MS) / 60000);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}