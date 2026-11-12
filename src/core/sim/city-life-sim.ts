/**
 * @module city-life-sim — headless Langlauf und Trace-Auswertung
 *
 * Der Lauf benutzt exakt `tickWorld`, `createCityLifeState` und die
 * gemeinsame Stadt-Logik. Kein DOM, kein Pixi, keine Wall-Clock und kein
 * zweiter Simulationspfad; der Seed steuert Stadt und Welt-PRNG.
 */
import { Ledger } from '../economy/ledger';
import { Prng } from '../rng/prng';
import { TICKS_PER_DAY } from './demand';
import { createCityLifeState } from './city-life';
import type { CityDecisionFamily, CityLifeDecision } from './city-life-types';
import { createWorld, ensureStarter } from './templates';
import { tickWorld } from './tick';
import type { WorldState } from './types';

export interface CityLifeRun {
  readonly world: WorldState;
  readonly decisions: readonly CityLifeDecision[];
  readonly ledger: Ledger;
  readonly prng: Prng;
}

export interface CityLifeChain {
  readonly meal: CityLifeDecision;
  readonly memory: CityLifeDecision;
  readonly use: CityLifeDecision;
}

export function runCityLifeSimulation(seed: number, days: number): CityLifeRun {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityLife = createCityLifeState(seed);
  const ledger = new Ledger({});
  const prng = new Prng(seed);
  const seen = new Set<number>();
  const decisions: CityLifeDecision[] = [];
  for (let tick = 0; tick < TICKS_PER_DAY * days; tick += 1) {
    tickWorld(world, ledger, prng);
    for (const decision of world.cityLife.lastDecisions ?? []) {
      if (seen.has(decision.id)) continue;
      seen.add(decision.id);
      decisions.push(decision);
    }
  }
  return { world, decisions, ledger, prng };
}

export function changedFamilies(decisions: readonly CityLifeDecision[]): Map<CityDecisionFamily, number> {
  const counts = new Map<CityDecisionFamily, number>();
  for (const decision of decisions) {
    for (const probe of decision.counterfactuals) {
      if (!probe.changed) continue;
      counts.set(probe.family, (counts.get(probe.family) ?? 0) + 1);
    }
  }
  return counts;
}

/** Findet die erste durchgehende Kette: Essen -> soziale Erinnerung -> anderes Verhalten. */
export function findCausalChain(decisions: readonly CityLifeDecision[]): CityLifeChain | null {
  for (const meal of decisions) {
    if (meal.intent !== 'EAT_OUT' || meal.outcome.moneyDelta >= 0
      || meal.outcome.hungerDelta >= 0 || meal.outcome.moodDelta <= 0) continue;
    const memories = decisions.filter((entry) => entry.tick > meal.tick
      && entry.npcId === meal.npcId
      && entry.outcome.memoryCreatedId !== null
      && (entry.intent === 'PUB' || entry.intent === 'VISIT_FRIEND'));
    for (const memory of memories) {
      const use = decisions.find((entry) => entry.tick > memory.tick
        && entry.npcId === meal.npcId
        && entry.memoryId === memory.outcome.memoryCreatedId
        && entry.counterfactuals.some((probe) => probe.family === 'memory' && probe.changed));
      if (use) return { meal, memory, use };
    }
  }
  return null;
}

/** Kompakte, stabile Trace-Sicht; keine kompletten Alternativlisten doppelt. */
export function compactDecision(decision: CityLifeDecision): Record<string, unknown> {
  return {
    id: decision.id, tick: decision.tick, day: decision.day, hour: decision.hour,
    npcId: decision.npcId, npcName: decision.npcName,
    scheduledIntent: decision.scheduledIntent, intent: decision.intent,
    location: decision.location, reasons: decision.reasons,
    factors: decision.factors, counterfactuals: decision.counterfactuals,
    environment: decision.environment, memoryId: decision.memoryId,
    relationship: decision.relationship, outcome: decision.outcome,
    socialTarget: decision.socialTarget,
  };
}
