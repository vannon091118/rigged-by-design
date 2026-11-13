/**
 * @module city-life-apply — Wirkung einer Stadt-Entscheidung
 *
 * Der Intent ist erst dann echt, wenn er Beduerfnisse, Bargeld, Faehigkeiten,
 * Beziehung und Erinnerung veraendert. Jede Aenderung landet im Outcome der
 * Entscheidung, damit die naechste Entscheidung dieselben Werte liest.
 */
import { decisionSummary, type CityDecisionPlan } from './city-life-decision';
import { applyDrift, applyIntentEffects } from './city-life-effects';
import { addMemory, rumorMemory, socialMemory } from './city-life-memory';
import type {
  CityLifeDecision, CityResidentState, NpcMemory,
} from './city-life-types';
import type { CityDecisionInput } from './city-life-score';
import { clampNeed, satisfyNeed } from './needs-core';
import { clampInt } from './num';

const clampRelation = (value: number): number => clampInt(value, -100, 100);

interface CityApplyInput {
  readonly input: CityDecisionInput;
  readonly plan: CityDecisionPlan;
  readonly decisionId: number;
  readonly elapsedHours: number;
  readonly nextMemoryId: number;
  /**
   * Ist der Bewohner schon am Ort der Handlung? Nur dann bucht die Entscheidung
   * Geld, Faehigkeit und soziale Wirkung. Sonst laeuft die Reise, und die
   * Ankunft bucht die Wirkung nach (#504).
   */
  readonly settled?: boolean;
}

interface CityApplyResult {
  readonly resident: CityResidentState;
  readonly decision: CityLifeDecision;
  readonly relationshipTarget: string | null;
  readonly relationshipDelta: number;
  readonly nextMemoryId: number;
}

/** Fuehrt Intent, Oekonomie und soziale Folgen in einem Schritt zusammen. */
export function applyCityDecision({
  input, plan, decisionId, elapsedHours, nextMemoryId, settled = true,
}: CityApplyInput): CityApplyResult {
  const { resident, tick, scheduled } = input;
  const { choice, socialTarget } = plan;
  const before = resident.needs;
  const effects = settled
    ? applyIntentEffects(before, choice.intent, elapsedHours, resident.skills)
    : applyDrift(before, choice.intent, elapsedHours);
  let mood = effects.mood;
  const social = effects.social;
  const hunger = effects.hunger;
  const thirst = effects.thirst;
  const fatigue = effects.fatigue;
  const cooking = effects.cooking;
  const work = effects.work;
  const socialSkill = effects.socialSkill;
  let memoryId = nextMemoryId;
  let memories = resident.memories;
  let relationshipDelta = 0;
  let relationshipTarget: string | null = null;
  let createdMemoryId: number | null = null;
  let createdMemoryKind: NpcMemory['kind'] | null = null;
  const target = socialTarget
    ? input.peers.find((peer) => peer.npcId === socialTarget) ?? null
    : null;
  if (settled && target && (choice.intent === 'PUB' || choice.intent === 'VISIT_FRIEND')) {
    relationshipTarget = target.npcId;
    relationshipDelta = choice.intent === 'VISIT_FRIEND' ? 6 : 4;
    const current = resident.relationships[target.npcId] ?? 0;
    memories = addMemory(memories, socialMemory(target.npcId, tick, memoryId,
      { ...resident.relationships, [target.npcId]: clampRelation(current + relationshipDelta) }));
    createdMemoryId = memoryId;
    createdMemoryKind = 'SOCIAL';
    memoryId += 1;
    const rumor = rumorMemory({ ...resident, memories }, target, tick, memoryId, input.traits);
    if (rumor) {
      memories = addMemory(memories, rumor);
      createdMemoryId = rumor.id;
      createdMemoryKind = 'RUMOR';
      memoryId += 1;
    }
  }
  mood = clampNeed(satisfyNeed(mood,
    Math.max(0, hunger - 70) * 0.15,
    Math.max(0, thirst - 70) * 0.15,
    Math.max(0, fatigue - 70) * 0.1));
  const nextResident: CityResidentState = {
    ...resident,
    location: choice.location,
    intent: choice.intent,
    needs: {
      hunger: clampNeed(hunger), thirst: clampNeed(thirst), fatigue: clampNeed(fatigue),
      social: clampNeed(social), mood: clampNeed(mood), money: Math.max(0, Math.round(effects.money)),
    },
    // Ohne Ankunft bleibt der Skillstand unveraendert; die Ankunft bucht nach.
    skills: settled ? { cooking, work, social: socialSkill } : resident.skills,
    relationships: relationshipTarget
      ? {
        ...resident.relationships,
        [relationshipTarget]: clampRelation((resident.relationships[relationshipTarget] ?? 0) + relationshipDelta),
      }
      : resident.relationships,
    memories,
  };
  const summary = decisionSummary(choice, plan);
  const decision: CityLifeDecision = {
    id: decisionId,
    tick,
    day: input.day,
    hour: input.hour,
    npcId: resident.npcId,
    npcName: resident.name,
    scheduledIntent: scheduled,
    intent: choice.intent,
    location: choice.location,
    previousLocation: resident.location,
    ...summary,
    environment: {
      day: input.day, hour: input.hour, location: choice.location,
      present: plan.present, cash: before.money, mood: before.mood,
    },
    memoryId: plan.memoryId,
    relationship: plan.relationship,
    outcome: {
      moneyDelta: nextResident.needs.money - before.money,
      hungerDelta: nextResident.needs.hunger - before.hunger,
      thirstDelta: nextResident.needs.thirst - before.thirst,
      fatigueDelta: nextResident.needs.fatigue - before.fatigue,
      socialDelta: nextResident.needs.social - before.social,
      moodDelta: nextResident.needs.mood - before.mood,
      cookingDelta: nextResident.skills.cooking - resident.skills.cooking,
      workDelta: nextResident.skills.work - resident.skills.work,
      socialSkillDelta: nextResident.skills.social - resident.skills.social,
      memoryCreatedId: createdMemoryId,
      memoryKind: createdMemoryKind,
    },
    socialTarget: target?.npcId ?? null,
  };
  return {
    resident: nextResident,
    decision,
    relationshipTarget,
    relationshipDelta,
    nextMemoryId: memoryId,
  };
}
