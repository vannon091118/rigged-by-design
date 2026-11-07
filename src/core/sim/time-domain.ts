/**
 * TimeDomain — Defines a local rate and step size for a subsystem,
 * mapped onto the single WorldTime without introducing a second clock.
 *
 * A TimeDomain allows a subsystem (e.g. physics, social decay, economy)
 * to advance at its own rate while staying synchronized to WorldTime.
 */

import type { WorldTime } from "./worldtime";
import { TICK_MS } from "./worldtime";

export interface TimeDomainConfig {
  readonly domainId: string;
  /** Ticks per domain step (e.g. 1 = every tick, 60 = every 60 ticks) */
  readonly ticksPerStep: number;
  /** Local rate multiplier (1.0 = realtime, 2.0 = double speed, 0.5 = half speed) */
  readonly rate: number;
  /** Catch-up strategy when behind: "none" | "step" | "burst" */
  readonly catchUp: "none" | "step" | "burst";
}

export interface TimeDomainState {
  readonly domainId: string;
  readonly accumulator: number; // ms accumulator for this domain
  readonly lastWorldTick: number;
  readonly pendingSteps: number;
}

export function createTimeDomain(config: TimeDomainConfig): TimeDomainState {
  return {
    domainId: config.domainId,
    accumulator: 0,
    lastWorldTick: 0,
    pendingSteps: 0,
  };
}

/**
 * Advance the TimeDomain given the new WorldTime.
 * Returns how many domain steps should execute.
 */
export function advanceTimeDomain(
  state: TimeDomainState,
  config: TimeDomainConfig,
  worldTime: WorldTime
): { state: TimeDomainState; stepsToExecute: number } {
  const deltaTicks = worldTime.tick - state.lastWorldTick;
  if (deltaTicks <= 0) {
    return { state, stepsToExecute: 0 };
  }

  const deltaMs = deltaTicks * TICK_MS;
  let nextAccumulator = state.accumulator + deltaMs * config.rate;

  // Compute how many steps are due
  const msPerStep = config.ticksPerStep * TICK_MS;
  let pendingSteps = state.pendingSteps;

  while (nextAccumulator >= msPerStep && pendingSteps < 1000) {
    pendingSteps++;
    nextAccumulator -= msPerStep;
  }

  const nextState: TimeDomainState = {
    domainId: state.domainId,
    accumulator: nextAccumulator,
    lastWorldTick: worldTime.tick,
    pendingSteps,
  };

  return { state: nextState, stepsToExecute: pendingSteps };
}

/**
 * Consume one pending step. Call after executing a domain step.
 */
export function consumeStep(state: TimeDomainState): TimeDomainState {
  return {
    ...state,
    pendingSteps: Math.max(0, state.pendingSteps - 1),
  };
}

export function domainStepIntervalMs(config: TimeDomainConfig): number {
  return config.ticksPerStep * TICK_MS;
}