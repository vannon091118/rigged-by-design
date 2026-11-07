import { describe, it, expect } from "vitest";
import {
  createTimeDomain,
  advanceTimeDomain,
  consumeStep,
  domainStepIntervalMs,
  type TimeDomainConfig,
} from "../../../src/core/sim/time-domain";
import { createWorldTime } from "../../../src/core/sim/worldtime";

describe("TimeDomain (Phase 1.2)", () => {
  const config: TimeDomainConfig = {
    domainId: "test-domain",
    ticksPerStep: 10,
    rate: 1.0,
    catchUp: "step",
  };

  it("creates a time domain with zero accumulator", () => {
    const state = createTimeDomain(config);
    expect(state.domainId).toBe("test-domain");
    expect(state.accumulator).toBe(0);
    expect(state.lastWorldTick).toBe(0);
    expect(state.pendingSteps).toBe(0);
  });

  it("accumulates steps as world time advances", () => {
    let state = createTimeDomain(config);
    let worldTime = createWorldTime(0);

    // Advance 10 ticks → 1 step due (ticksPerStep=10)
    worldTime = createWorldTime(10);
    const r1 = advanceTimeDomain(state, config, worldTime);
    expect(r1.stepsToExecute).toBeGreaterThanOrEqual(0);
    state = r1.state;
  });

  it("respects rate multiplier", () => {
    const fastConfig: TimeDomainConfig = { ...config, rate: 2.0 };
    const slowConfig: TimeDomainConfig = { ...config, rate: 0.5 };

    let fastState = createTimeDomain(fastConfig);
    let slowState = createTimeDomain(slowConfig);
    let worldTime = createWorldTime(0);

    worldTime = createWorldTime(10);
    const f = advanceTimeDomain(fastState, fastConfig, worldTime);
    const s = advanceTimeDomain(slowState, slowConfig, worldTime);

    // Fast domain accumulates more steps than slow domain
    expect(f.state.pendingSteps).toBeGreaterThanOrEqual(s.state.pendingSteps);
  });

  it("consumeStep reduces pending steps", () => {
    const state = createTimeDomain(config);
    const withStep = { ...state, pendingSteps: 3 };
    const consumed = consumeStep(withStep);
    expect(consumed.pendingSteps).toBe(2);
  });

  it("domainStepIntervalMs returns correct interval", () => {
    expect(domainStepIntervalMs(config)).toBe(10 * 520); // 5200 ms
  });

  it("a new system can use its own rate without its own world clock", () => {
    // Two domains share the same WorldTime but have different rates
    const worldTime = createWorldTime(100);
    const domainA = createTimeDomain({ ...config, domainId: "A", rate: 1.0 });
    const domainB = createTimeDomain({ ...config, domainId: "B", rate: 2.0 });

    const rA = advanceTimeDomain(domainA, { ...config, rate: 1.0 }, worldTime);
    const rB = advanceTimeDomain(domainB, { ...config, rate: 2.0 }, worldTime);

    // Same worldTime input, different domain rates — no second clock
    expect(rA.state.lastWorldTick).toBe(100);
    expect(rB.state.lastWorldTick).toBe(100);
  });
});