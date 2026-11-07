/**
 * ClockAdapter — Maps host/system steps and game steps onto WorldTime.
 * Drift-free translation: no accumulation of rounding errors across adapters.
 */

import type { WorldTime } from "./worldtime";
import { advanceTick, createWorldTime } from "./worldtime";

export interface ClockAdapterConfig {
  readonly hostTickMs: number;      // TICK_MS from host (default 520)
  readonly maxCatchUpTicks: number; // max ticks to catch up in one callback
}

export interface ClockAdapterState {
  readonly worldTime: WorldTime;
  readonly hostTicksProcessed: number;
  readonly lastHostMs: number;
  readonly isPaused: boolean;
}

export function createClockAdapter(
  config: ClockAdapterConfig,
  initialTick = 0
): ClockAdapterState {
  return {
    worldTime: createWorldTime(initialTick),
    hostTicksProcessed: 0,
    // Host time is an input, never read from the wall clock: the adapter
    // starts at the deterministic time implied by the initial tick.
    lastHostMs: initialTick * config.hostTickMs,
    isPaused: false,
  };
}

export function tickHost(
  state: ClockAdapterState,
  config: ClockAdapterConfig,
  nowMs: number
): { state: ClockAdapterState; worldTicksAdvanced: number } {
  if (state.isPaused) {
    return { state, worldTicksAdvanced: 0 };
  }

  const elapsedMs = nowMs - state.lastHostMs;
  const elapsedTicks = Math.floor(elapsedMs / config.hostTickMs);

  let worldTicksAdvanced = 0;
  let nextState = state;

  // Advance world ticks, bounded by maxCatchUpTicks to prevent spiral of death
  let remaining = Math.min(elapsedTicks, config.maxCatchUpTicks);
  while (remaining > 0) {
    nextState = {
      ...nextState,
      worldTime: advanceTick(nextState.worldTime, 1),
      hostTicksProcessed: nextState.hostTicksProcessed + 1,
    };
    worldTicksAdvanced++;
    remaining--;
  }

  nextState = {
    ...nextState,
    lastHostMs: nowMs,
  };

  return { state: nextState, worldTicksAdvanced };
}

export function pause(state: ClockAdapterState): ClockAdapterState {
  return { ...state, isPaused: true };
}

export function resume(state: ClockAdapterState): ClockAdapterState {
  return { ...state, isPaused: false };
}

export function fastForward(
  state: ClockAdapterState,
  ticks: number
): { state: ClockAdapterState; worldTime: WorldTime } {
  let next = state;
  for (let i = 0; i < ticks; i++) {
    next = { ...next, worldTime: advanceTick(next.worldTime, 1) };
  }
  return { state: next, worldTime: next.worldTime };
}