import { describe, it, expect } from "vitest";
import {
  createWorldTime,
  advanceTick,
  TICK_MS,
  TICKS_PER_DAY,
  MS_PER_DAY,
  isSameDay,
  ticksToMs,
  msToTicks,
  ticksFromDayStart,
  ticksToDayStart,
  timeOfDayString,
} from "../../../src/core/sim/worldtime";

describe("WorldTime (Phase 1.2)", () => {
  it("has correct constants", () => {
    expect(TICK_MS).toBe(520);
    expect(TICKS_PER_DAY).toBe(600);
    expect(MS_PER_DAY).toBe(312000);
  });

  it("creates initial time at tick 0", () => {
    const t = createWorldTime();
    expect(t.tick).toBe(0);
    expect(t.day).toBe(0);
    expect(t.tickInDay).toBe(0);
    expect(t.ms).toBe(0);
  });

  it("advances ticks correctly", () => {
    let t = createWorldTime(0);
    t = advanceTick(t);
    expect(t.tick).toBe(1);
    expect(t.day).toBe(0);
    expect(t.tickInDay).toBe(1);
  });

  it("advances by multiple steps", () => {
    const t = advanceTick(createWorldTime(0), 10);
    expect(t.tick).toBe(10);
    expect(t.day).toBe(0);
    expect(t.tickInDay).toBe(10);
  });

  it("rolls over day at TICKS_PER_DAY", () => {
    const t = advanceTick(createWorldTime(TICKS_PER_DAY - 1));
    expect(t.day).toBe(1);
    expect(t.tickInDay).toBe(0);
  });

  it("computes ticks from day start", () => {
    const t = createWorldTime(100);
    expect(ticksFromDayStart(t)).toBe(100);
  });

  it("computes ticks to day start", () => {
    const t = createWorldTime(700); // day 1, tickInDay 100
    expect(ticksToDayStart(t)).toBe(600);
  });

  it("checks same day", () => {
    const a = createWorldTime(100);
    const b = createWorldTime(200);
    const c = createWorldTime(TICKS_PER_DAY + 50);
    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, c)).toBe(false);
  });

  it("converts ticks to ms", () => {
    expect(ticksToMs(1)).toBe(520);
    expect(ticksToMs(100)).toBe(52000);
  });

  it("converts ms to ticks", () => {
    expect(msToTicks(520)).toBe(1);
    expect(msToTicks(1000)).toBe(1);
  });

  it("produces time-of-day string", () => {
    // tickInDay = 100 → 52000 ms → 52000/60000 = 0.866 min → 0 hours, 0 minutes
    const t = createWorldTime(100);
    const tod = timeOfDayString(t);
    expect(tod).toMatch(/^\d{2}:\d{2}$/);
  });

  it("is deterministic: same inputs → same outputs", () => {
    const t1 = createWorldTime(12345);
    const t2 = createWorldTime(12345);
    expect(t1).toEqual(t2);
    const a1 = advanceTick(t1);
    const a2 = advanceTick(t2);
    expect(a1).toEqual(a2);
  });
});