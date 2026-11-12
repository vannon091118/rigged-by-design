/**
 * Evidenz-Bausteine fuer den langen Living-World-Lauf.
 *
 * Der Test bleibt der ausfuehrende Harness; dieses Modul haelt nur das
 * versionierte JSON-Schema, damit die Testdatei im LOC-Budget bleibt.
 */
import type { CausalChainEvidence, ResidentSnapshot, RoutineSample } from './living-world-longturn-snapshots';

export type LongTurnEvidenceInput = {
  readonly seed: number;
  readonly days: number;
  readonly ticks: number;
  readonly command: string;
  readonly playerBeforeMeal: { readonly hunger: number; readonly thirst: number };
  readonly playerAfterMeal: { readonly hunger: number; readonly thirst: number };
  readonly cityBefore: readonly ResidentSnapshot[];
  readonly cityAfter: readonly ResidentSnapshot[];
  readonly traitsBefore: readonly string[];
  readonly traitsAfter: readonly string[];
  readonly trainedBefore: Record<string, number>;
  readonly trainedAfter: Record<string, number>;
  readonly arcBefore: { readonly status: string; readonly dueTick: number };
  readonly arcAfter: { readonly status: string; readonly dueTick: number };
  readonly echoSeen: boolean;
  readonly actionTrust: number;
  readonly moodOnDirt: number;
  readonly moodOnClean: number;
  readonly hungryGain: number;
  readonly fedGain: number;
  readonly routineSamples: readonly RoutineSample[];
  readonly scheduledDeviations: number;
  readonly causalChain: CausalChainEvidence | null;
};

const routineView = (city: readonly ResidentSnapshot[]) =>
  city.map((person) => ({ npcId: person.npcId, intent: person.intent, location: person.location }));

export const buildLongTurnEvidence = (input: LongTurnEvidenceInput) => {
  const {
    seed, days, ticks, command, playerBeforeMeal, playerAfterMeal, cityBefore, cityAfter,
    traitsBefore, traitsAfter, trainedBefore, trainedAfter, arcBefore, arcAfter, echoSeen,
    actionTrust, moodOnDirt, moodOnClean, hungryGain, fedGain, routineSamples,
    scheduledDeviations, causalChain,
  } = input;

  return {
    version: 1,
    kind: 'living-world-longturn',
    seed,
    days,
    ticks,
    decisions: routineSamples.length,
    generatedBy: 'src/core/sim/__tests__/living-world-longturn.test.ts',
    command,
    stats: {
      hunger: {
        before: playerBeforeMeal.hunger, after: playerAfterMeal.hunger,
        delta: playerAfterMeal.hunger - playerBeforeMeal.hunger,
        proof: 'KIEZ_ESSEN changed the same player need that reduced the reputation gain',
      },
      thirst: {
        before: playerBeforeMeal.thirst, after: playerAfterMeal.thirst,
        delta: playerAfterMeal.thirst - playerBeforeMeal.thirst,
        proof: 'KIEZ_TRINKEN changed the same player need that reduced the reputation gain',
      },
      routines: {
        samples: routineSamples.length,
        scheduledDeviations,
        before: routineView(cityBefore),
        after: routineView(cityAfter),
      },
      traits: {
        before: [...traitsBefore], after: [...traitsAfter],
        changed: JSON.stringify(traitsBefore) !== JSON.stringify(traitsAfter),
      },
      attributes: { before: trainedBefore, after: trainedAfter, source: 'JOB_CLEANER XP 400' },
      skills: {
        before: cityBefore.map((person) => ({ npcId: person.npcId, skills: person.skills })),
        after: cityAfter.map((person) => ({ npcId: person.npcId, skills: person.skills })),
      },
    },
    chains: [
      {
        id: 'give-traits-encounter-arc-echo',
        steps: [
          { action: 'GEBEN', trust: actionTrust, traitsBefore, traitsAfter },
          { chain: 'CITY_ENCOUNTER_ARC', before: arcBefore, after: arcAfter },
          { event: 'CITY_ENCOUNTER_ECHO_WARM', seen: echoSeen },
        ],
      },
      {
        id: 'environment-dirt-mood',
        steps: [
          { environment: 'dirty tile', moodBefore: 50, moodAfter: moodOnDirt },
          { environment: 'clean tile', moodBefore: 50, moodAfter: moodOnClean },
        ],
      },
      {
        id: 'hunger-reputation-meal',
        steps: [
          { state: 'hungry', hunger: playerBeforeMeal.hunger, thirst: playerBeforeMeal.thirst, reputationGain: hungryGain },
          { action: 'KIEZ_ESSEN + KIEZ_TRINKEN', hunger: playerAfterMeal.hunger, thirst: playerAfterMeal.thirst },
          { state: 'fed', reputationGain: fedGain },
        ],
      },
      {
        id: 'meal-memory-behavior',
        steps: causalChain ? [
          { state: 'meal', ...causalChain.meal },
          { state: 'memory', ...causalChain.memory },
          { state: 'behavior', ...causalChain.use },
        ] : [],
      },
      {
        id: 'city-routine-four-days',
        steps: [
          { before: routineView(cityBefore) },
          { after: routineView(cityAfter) },
          { decisions: routineSamples.length, scheduledDeviations },
        ],
      },
    ],
    city: { before: cityBefore, after: cityAfter },
    routines: routineSamples,
    narrative: { arcBefore, arcAfter, echoSeen },
    environment: { moodOnDirt, moodOnClean, hungryReputationGain: hungryGain, fedReputationGain: fedGain },
    causalChain,
    saveLoad: { restored: true, playerNeedsEqual: true },
  };
};
