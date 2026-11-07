/**
 * Contract: WorldTime (v1.0.0)
 * Single authoritative world time, separated from Host Pacing, Wall-Clock,
 * and Presentation Clock. Drives tickWorld() via the world store.
 * Merged in Phase 0.5 as a baseline contract.
 *
 * Re-exports from src/core/sim/worldtime.ts for backward compatibility.
 */

export {
  TICK_MS,
  TICKS_PER_DAY,
  MS_PER_DAY,
  type WorldTime,
  createWorldTime,
  advanceTick,
  ticksFromDayStart,
  ticksToDayStart,
  isSameDay,
  ticksToMs,
  msToTicks,
  timeOfDayString,
} from "./sim/worldtime";