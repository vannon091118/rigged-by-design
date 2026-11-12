/** Snapshots und kompakte Ketten-Sichten fuer den long-turn Evidenz-Lauf. */
import type { CityLifeChain } from './city-life-sim';
import type { CityLifeDecision, CityLifeState, CityResidentState } from './city-life-types';
import type { ChainRun } from './narrative/chains/chain-types';
import type { WorldState } from './types';

export type ResidentSnapshot = {
  readonly npcId: string;
  readonly needs: CityResidentState['needs'];
  readonly attributes: CityResidentState['attributes'];
  readonly skills: CityResidentState['skills'];
  readonly relationships: number;
  readonly memories: number;
  readonly intent: string;
  readonly location: string;
};

export type RoutineSample = {
  readonly id: number;
  readonly tick: number;
  readonly day: number;
  readonly hour: number;
  readonly npcId: string;
  readonly scheduled: string;
  readonly intent: string;
  readonly location: string;
};

export type ArcSnapshot = {
  readonly status: string;
  readonly dueTick: number;
  readonly eventInstanceId: number | null;
};

export type CausalChainEvidence = {
  readonly meal: { readonly tick: number; readonly npcId: string; readonly intent: string; readonly hungerDelta: number; readonly moodDelta: number };
  readonly memory: { readonly tick: number; readonly npcId: string; readonly intent: string; readonly memoryId: number | null };
  readonly use: { readonly tick: number; readonly npcId: string; readonly intent: string; readonly memoryId: number | null };
};

export const residentSnapshot = (resident: CityResidentState): ResidentSnapshot => ({
  npcId: resident.npcId,
  needs: { ...resident.needs },
  attributes: { ...resident.attributes },
  skills: { ...resident.skills },
  relationships: Object.keys(resident.relationships).length,
  memories: resident.memories.length,
  intent: resident.intent,
  location: resident.location,
});

export const citySnapshot = (life: CityLifeState): readonly ResidentSnapshot[] =>
  life.residents.map(residentSnapshot);

export const arcSnapshot = (run: ChainRun | undefined): ArcSnapshot => ({
  status: run?.status ?? 'MISSING',
  dueTick: run?.dueTick ?? -1,
  eventInstanceId: run?.eventInstanceId ?? null,
});

export const rpgSnapshot = (rpg: WorldState['player']['rpg']): Record<string, number> => ({
  level: rpg.level, xp: rpg.xp, speed: rpg.speedLevel, charisma: rpg.charismaLevel,
  brawl: rpg.brawlLevel, perception: rpg.perceptionLevel, technique: rpg.techniqueLevel,
  endurance: rpg.enduranceLevel, luck: rpg.luckLevel,
});

export const routineSample = (decision: CityLifeDecision): RoutineSample => ({
  id: decision.id, tick: decision.tick, day: decision.day, hour: decision.hour,
  npcId: decision.npcId, scheduled: decision.scheduledIntent,
  intent: decision.intent, location: decision.location,
});

export const summarizeCausalChain = (chain: CityLifeChain): CausalChainEvidence => ({
  meal: {
    tick: chain.meal.tick, npcId: chain.meal.npcId, intent: chain.meal.intent,
    hungerDelta: chain.meal.outcome.hungerDelta, moodDelta: chain.meal.outcome.moodDelta,
  },
  memory: {
    tick: chain.memory.tick, npcId: chain.memory.npcId, intent: chain.memory.intent,
    memoryId: chain.memory.outcome.memoryCreatedId,
  },
  use: {
    tick: chain.use.tick, npcId: chain.use.npcId, intent: chain.use.intent,
    memoryId: chain.use.memoryId,
  },
});
