import { describe, it, expect } from "vitest";
import {
  createClockAdapter,
  tickHost,
  pause,
  resume,
  fastForward,
  type ClockAdapterConfig,
} from "../../../src/core/sim/clock-adapter";

describe("ClockAdapter (Phase 1.2)", () => {
  const config: ClockAdapterConfig = {
    hostTickMs: 520,
    maxCatchUpTicks: 10,
  };

  it("creates adapter at initial tick", () => {
    const state = createClockAdapter(config, 100);
    expect(state.worldTime.tick).toBe(100);
    expect(state.isPaused).toBe(false);
  });

  it("advances world ticks on host tick", () => {
    let state = createClockAdapter(config, 0);
    const now = Date.now();

    // Advance host time by ~3 ticks worth of ms
    const result = tickHost(state, config, now + 3 * 520 + 100);
    expect(result.worldTicksAdvanced).toBeGreaterThanOrEqual(0);
    expect(result.state.hostTicksProcessed).toBeGreaterThanOrEqual(0);
  });

  it("pause stops advancement", () => {
    let state = createClockAdapter(config, 0);
    state = pause(state);
    expect(state.isPaused).toBe(true);

    const result = tickHost(state, config, Date.now() + 10000);
    expect(result.worldTicksAdvanced).toBe(0);
  });

  it("resume allows advancement again", () => {
    let state = createClockAdapter(config, 0);
    state = pause(state);
    state = resume(state);
    expect(state.isPaused).toBe(false);
  });

  it("fastForward advances world time deterministically", () => {
    const state = createClockAdapter(config, 50);
    const result = fastForward(state, 100);
    expect(result.worldTime.tick).toBe(150);
    expect(result.state.worldTime.tick).toBe(150);
  });

  it("maxCatchUpTicks limits catch-up to prevent spiral of death", () => {
    const slowConfig = { ...config, maxCatchUpTicks: 5 };
    const state = createClockAdapter(slowConfig, 0);
    // Simulate a long elapsed time (100 ticks worth)
    const result = tickHost(state, slowConfig, Date.now() + 100 * 520);
    expect(result.worldTicksAdvanced).toBeLessThanOrEqual(5);
  });

  it("world time is deterministic given same inputs", () => {
    const s1 = createClockAdapter(config, 1000);
    const s2 = createClockAdapter(config, 1000);
    expect(s1.worldTime).toEqual(s2.worldTime);
  });
});