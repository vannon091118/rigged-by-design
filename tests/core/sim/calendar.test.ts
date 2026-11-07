import { describe, it, expect } from "vitest";
import { calendarFromWorldTime, isWeekend, WEEKDAYS, SEASONS } from "../../../src/core/sim/calendar";
import { createWorldTime } from "../../../src/core/sim/worldtime";

describe("Calendar (Phase 1.2)", () => {
  it("derives date from WorldTime", () => {
    const cal = calendarFromWorldTime(createWorldTime(0));
    expect(cal.day).toBe(0);
    expect(cal.year).toBe(0);
    expect(WEEKDAYS).toContain(cal.weekday);
    expect(SEASONS).toContain(cal.season);
  });

  it("weekday cycles through 7 days", () => {
    const weekdays = new Set<string>();
    // Use ticks that span multiple days (TICKS_PER_DAY = 600)
    for (let d = 0; d < 14 * 600; d += 600) {
      const cal = calendarFromWorldTime(createWorldTime(d));
      weekdays.add(cal.weekday);
    }
    expect(weekdays.size).toBe(7);
  });

  it("season advances every 30 days", () => {
    const c0 = calendarFromWorldTime(createWorldTime(0));
    // 30 days = 30 * 600 ticks
    const c30 = calendarFromWorldTime(createWorldTime(30 * 600));
    expect(c0.season).toBe("Spring");
    expect(c30.season).toBe("Summer");
  });

  it("timeOfDay is derived from tickInDay", () => {
    const noon = calendarFromWorldTime(createWorldTime(0)); // 00:00
    expect(noon.timeOfDay).toBe("00:00");
  });

  it("isWeekend detects Saturday/Sunday", () => {
    // Day 5 = Saturday (tick 5*600), Day 6 = Sunday (tick 6*600)
    expect(isWeekend(createWorldTime(5 * 600))).toBe(true);
    expect(isWeekend(createWorldTime(6 * 600))).toBe(true);
  });

  it("no independent mutable clock — everything derives from WorldTime", () => {
    const t = createWorldTime(1000);
    const cal1 = calendarFromWorldTime(t);
    const cal2 = calendarFromWorldTime(t);
    expect(cal1).toEqual(cal2);
  });
});