/**
 * @module city-life-decision — Entscheidung plus Gegenfakt-Proben
 *
 * Der gewaehlte Intent und die zwoelf Familien werden mit derselben Score-Funktion
 * verglichen. Eine Probe neutralisiert genau eine Familie; nur wenn der Intent
 * dadurch kippt, traegt der Trace `changed: true`. Das ist die belegbare Kette
 * von Stat zu Entscheidung, keine nachtraegliche Behauptung.
 */
import { chooseCityIntent, type CityChoice, type CityDecisionInput } from './city-life-score';
import { bestFriend, presentAt } from './city-life-targets';
import type {
  CityDecisionCounterfactual, CityDecisionFamily, CityLifeDecision,
  CityResidentState, NpcMemory,
} from './city-life-types';
import type { NpcIntentKind } from './npc-types';

export interface CityDecisionPlan {
  readonly choice: CityChoice;
  readonly counterfactuals: readonly CityDecisionCounterfactual[];
  readonly memoryId: number | null;
  readonly relationship: { readonly npcId: string; readonly value: number } | null;
  readonly socialTarget: string | null;
  readonly present: readonly string[];
}

const FAMILIES: readonly CityDecisionFamily[] = [
  'hunger', 'thirst', 'fatigue', 'routine', 'traits', 'attributes', 'skills',
  'emotion', 'relationship', 'memory', 'social', 'environment',
];

function withNeeds(resident: CityResidentState, patch: Partial<CityResidentState['needs']>): CityResidentState {
  return { ...resident, needs: { ...resident.needs, ...patch } };
}

function neutralInput(input: CityDecisionInput, family: CityDecisionFamily): CityDecisionInput {
  switch (family) {
    case 'hunger': return { ...input, resident: withNeeds(input.resident, { hunger: 0 }) };
    case 'thirst': return { ...input, resident: withNeeds(input.resident, { thirst: 0 }) };
    case 'fatigue': return { ...input, resident: withNeeds(input.resident, { fatigue: 0 }) };
    case 'social': return { ...input, resident: withNeeds(input.resident, { social: 0 }) };
    case 'emotion': return { ...input, resident: withNeeds(input.resident, { mood: 100 }) };
    case 'routine': return { ...input, scheduled: 'IDLE' as NpcIntentKind };
    case 'traits': return { ...input, traits: [] };
    case 'attributes': return { ...input, resident: { ...input.resident, attributes: { charisma: 0, intellect: 0 } } };
    case 'skills': return {
      ...input,
      resident: { ...input.resident, skills: { cooking: 0, work: 0, social: 0 } },
    };
    case 'relationship': return { ...input, resident: { ...input.resident, relationships: {} } };
    case 'memory': return { ...input, resident: { ...input.resident, memories: [] } };
    case 'environment': return { ...input, peers: [] };
  }
}

function memoryUsed(resident: CityResidentState, target: CityResidentState | null): NpcMemory | null {
  if (!target) return null;
  return [...resident.memories].reverse().find((entry) => entry.aboutNpcId === target.npcId) ?? null;
}

function targetFor(input: CityDecisionInput, intent: NpcIntentKind): CityResidentState | null {
  const friend = bestFriend(input);
  if (intent === 'VISIT_FRIEND') return friend?.peer ?? null;
  if (intent !== 'PUB') return null;
  const present = input.peers
    .filter((peer) => peer.location === 'KIEZ' && peer.npcId !== input.resident.npcId)
    .sort((first, second) => (input.resident.relationships[second.npcId] ?? 0)
      - (input.resident.relationships[first.npcId] ?? 0) || first.npcId.localeCompare(second.npcId));
  return present[0] ?? null;
}

/** Waehlt den Intent und prueft jede Stat-Familie gegen einen neutralen Lauf. */
export function decideCityLife(input: CityDecisionInput): CityDecisionPlan {
  const choice = chooseCityIntent(input);
  const target = targetFor(input, choice.intent);
  const counterfactuals = FAMILIES.map((family): CityDecisionCounterfactual => {
    const alternative = chooseCityIntent(neutralInput(input, family));
    return {
      family,
      intent: alternative.intent,
      changed: alternative.intent !== choice.intent,
      detail: `ohne ${family} -> ${alternative.intent}`,
    };
  });
  const cashAlternative = chooseCityIntent({ ...input, resident: withNeeds(input.resident, { money: 999_999 }) });
  if (cashAlternative.intent !== choice.intent) {
    counterfactuals.push({
      family: 'environment', intent: cashAlternative.intent, changed: true,
      detail: `ohne Bargeld -> ${cashAlternative.intent}`,
    });
  }
  const memory = memoryUsed(input.resident, target);
  return {
    choice,
    counterfactuals,
    memoryId: memory?.id ?? null,
    relationship: target
      ? { npcId: target.npcId, value: input.resident.relationships[target.npcId] ?? 0 }
      : null,
    socialTarget: target?.npcId ?? null,
    present: presentAt(input.peers, choice.location, input.resident.npcId),
  };
}

/** Die Entscheidung ohne Outcome; `city-life-apply.ts` fuellt die Wirkung. */
export function decisionSummary(
  choice: CityChoice, plan: Omit<CityDecisionPlan, 'choice'>,
): Pick<CityLifeDecision, 'reasons' | 'factors' | 'alternatives' | 'counterfactuals'> {
  const reasons = [...choice.factors]
    .sort((first, second) => Math.abs(second.delta) - Math.abs(first.delta))
    .slice(0, 5)
    .map((factor) => `${factor.detail} (${factor.delta >= 0 ? '+' : ''}${factor.delta})`);
  return {
    reasons: [`Plan ${choice.intent}`, ...reasons],
    factors: choice.factors,
    alternatives: choice.alternatives,
    counterfactuals: plan.counterfactuals,
  };
}
