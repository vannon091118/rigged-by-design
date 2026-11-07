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
} from "../../src/core/world-time";

describe("WorldTime contract", () => {
  it("has correct constants", () => {
    expect(TICK_MS).toBe(520);
    expect(TICKS_PER_DAY).toBe(600);
    expect(MS_PER_DAY).toBe(312000);
  });

  it("creates initial time", () => {
    const t = createWorldTime();
    expect(t.tick).toBe(0);
    expect(t.day).toBe(0);
    expect(t.tickInDay).toBe(0);
  });

  it("advances ticks correctly", () => {
    let t = createWorldTime(0);
    t = advanceTick(t);
    expect(t.tick).toBe(1);
    expect(t.day).toBe(0);
    expect(t.tickInDay).toBe(1);
  });

  it("rolls over day at TICKS_PER_DAY", () => {
    let t = createWorldTime(TICKS_PER_DAY - 1);
    t = advanceTick(t);
    expect(t.day).toBe(1);
    expect(t.tickInDay).toBe(0);
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
});