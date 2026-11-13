/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Headless-Langlauf: Drei benannte NPCs leben mehrere Sim-Tage im echten
 * `tickWorld`-Pfad. Der Trace belegt je Stat-Familie eine gekippte
 * Entscheidung und eine verkettete Folge aus Handlung, Zustandsänderung und
 * spaeterem andersartigem Verhalten. Kein DOM, kein Pixi, kein Wall-Clock.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replaySave, toSavedGame } from '../../../store/save';
import {
  changedFamilies, compactDecision, findCausalChain, runCityLifeSimulation,
} from '../city-life-sim';
import { decideCityLife } from '../city-life-decision';
import type { CityDecisionInput } from '../city-life-score';
import type { CityResidentState } from '../city-life-types';
import type { CityDecisionFamily, CityLifeDecision } from '../city-life-types';
import { TICKS_PER_DAY } from '../clock';

const SEED = 424242;
const DAYS = 5;
const ARTIFACT = 'artifacts/living-world/trace-424242-5d.json';
const FAMILIES: readonly CityDecisionFamily[] = [
  'hunger', 'thirst', 'fatigue', 'routine', 'traits', 'attributes', 'skills',
  'emotion', 'relationship', 'memory', 'social', 'environment',
];

function sequence(decisions: readonly CityLifeDecision[]): string {
  return JSON.stringify(decisions.map((entry) => `${entry.npcId}:${entry.intent}`));
}

describe('Living-World-Langlauf: kausaler Decision Trace', () => {
  it('belegt Stat-Einfluss und eine durchgehende Ereigniskette', { timeout: 30_000 }, () => {
    const result = runCityLifeSimulation(SEED, DAYS);
    const counts = changedFamilies(result.decisions);
    for (const family of FAMILIES) expect(counts.get(family) ?? 0, `Familie ${family} kippt keine Entscheidung`).toBeGreaterThan(0);
    expect(result.decisions.length).toBeGreaterThan(300);
    expect(new Set(result.decisions.map((entry) => entry.npcId)).size).toBe(3);
    expect(result.decisions.some((entry) => entry.scheduledIntent === 'WORK' && entry.intent === 'WORK')).toBe(true);
    expect(result.decisions.some((entry) => entry.scheduledIntent === 'COMMUTE')).toBe(true);
    expect(result.decisions.some((entry) => entry.scheduledIntent === 'EAT_OUT')).toBe(true);
    expect(result.decisions.some((entry) => entry.intent === 'SLEEP')).toBe(true);
    expect(result.decisions.some((entry) => entry.scheduledIntent !== entry.intent)).toBe(true);
    expect(result.decisions.some((entry) => entry.outcome.cookingDelta > 0)).toBe(true);
    expect(result.decisions.some((entry) => entry.outcome.workDelta > 0)).toBe(true);
    expect(result.decisions.some((entry) => entry.outcome.socialSkillDelta > 0)).toBe(true);
    // Bargeld bindet nur, solange es knapp ist: Der Lauf reichert die Bewohner
    // an, deshalb prueft dieselbe Entscheidungsfunktion hier einen armen,
    // hungrigen Bewohner statt einer zufaelligen Trace-Zeile.
    const poor: CityResidentState = {
      npcId: 'rita', visitorId: null, name: 'Rita Kern', role: 'Wirtin', location: 'HOME', intent: 'PUB',
      position: { x: 8, y: 12 }, travel: null,
      needs: { hunger: 20, thirst: 40, fatigue: 40, social: 70, money: 200, mood: 75 },
      attributes: { charisma: 8, intellect: 4 }, skills: { cooking: 20, work: 100, social: 20 },
      relationships: {}, memories: [], lastHour: 19, lastDay: 1,
    };
    const poorInput: CityDecisionInput = {
      resident: poor, scheduled: 'PUB', workplace: 'KIEZ', hour: 19, day: 1, tick: 475,
      peers: [], traits: [], seed: SEED,
    };
    const poorPlan = decideCityLife(poorInput);
    expect(poorPlan.choice.intent).toBe('WORK');
    expect(poorPlan.counterfactuals.some((probe) => probe.detail.includes('Bargeld') && probe.changed)).toBe(true);

    const chain = findCausalChain(result.decisions);
    expect(chain).not.toBeNull();
    if (!chain) throw new Error('Die Ereigniskette fehlt im Trace.');
    expect(chain.meal.outcome.moneyDelta).toBeLessThan(0);
    expect(chain.meal.outcome.hungerDelta).toBeLessThan(0);
    expect(chain.meal.outcome.moodDelta).toBeGreaterThan(0);
    expect(chain.memory.tick).toBeGreaterThan(chain.meal.tick);
    expect(chain.memory.npcId).toBe(chain.meal.npcId);
    expect(chain.memory.intent === 'PUB' || chain.memory.intent === 'VISIT_FRIEND').toBe(true);
    expect(chain.memory.socialTarget).not.toBeNull();
    expect(chain.memory.relationship?.npcId).toBe(chain.memory.socialTarget);
    expect(chain.memory.outcome.memoryKind === 'SOCIAL' || chain.memory.outcome.memoryKind === 'RUMOR').toBe(true);
    expect(chain.use.tick).toBeGreaterThan(chain.memory.tick);
    expect(chain.use.memoryId).toBe(chain.memory.outcome.memoryCreatedId);
    const memoryProbe = chain.use.counterfactuals.find((probe) => probe.family === 'memory' && probe.changed);
    if (!memoryProbe) throw new Error('Der Memory-Probe fehlt in der Ereigniskette.');
    expect(memoryProbe.family).toBe('memory');
    expect(memoryProbe.changed).toBe(true);
    expect(memoryProbe.intent).not.toBe(chain.use.intent);

    const replay = runCityLifeSimulation(SEED, 2);
    expect(JSON.stringify(replay.decisions)).toBe(JSON.stringify(result.decisions.slice(0, replay.decisions.length)));
    const alt = runCityLifeSimulation(SEED + 1, 2);
    expect(sequence(alt.decisions)).not.toBe(sequence(replay.decisions));

    const examples = Object.fromEntries(FAMILIES.map((family) => {
      const decision = result.decisions.find((entry) =>
        entry.counterfactuals.some((probe) => probe.family === family && probe.changed));
      return [family, decision ? {
        decision: compactDecision(decision),
        probe: decision.counterfactuals.find((probe) => probe.family === family && probe.changed),
      } : null];
    }));
    const payload = {
      seed: SEED, days: DAYS, ticks: TICKS_PER_DAY * DAYS,
      generatedBy: 'src/core/sim/__tests__/living-world-causal-trace.test.ts',
      familyCounts: Object.fromEntries(counts),
      families: examples,
      chain: {
        meal: compactDecision(chain.meal), memory: compactDecision(chain.memory),
        use: compactDecision(chain.use), probe: memoryProbe,
      },
      determinism: { sameSeed: true, replayDecisions: replay.decisions.length },
      seedVariation: { seed: SEED + 1, different: true, sample: sequence(alt.decisions).slice(0, 400) },
      decisions: result.decisions.map(compactDecision),
    };
    if (process.env.RBD_LIVING_WORLD_OUT) {
      const target = resolve(process.cwd(), process.env.RBD_LIVING_WORLD_OUT || ARTIFACT);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
    }
    console.log(`[living-world] seed=${SEED} days=${DAYS} decisions=${result.decisions.length} `
      + `families=${FAMILIES.map((family) => `${family}:${counts.get(family) ?? 0}`).join(',')}`);
    console.log(`[living-world] chain=${chain.meal.npcId} meal@${chain.meal.day}/${chain.meal.hour} `
      + `memory=${chain.memory.outcome.memoryCreatedId}@${chain.memory.day}/${chain.memory.hour} `
      + `use@${chain.use.day}/${chain.use.hour}->${chain.use.intent}`);
  });

  it('bewahrt Attribute, Faehigkeiten, Beziehungen und Erinnerungen ueber Save/Load', () => {
    const { world, ledger, prng } = runCityLifeSimulation(SEED, 1);
    const before = world.cityLife.residents.map((resident) => ({
      npcId: resident.npcId, needs: resident.needs, attributes: resident.attributes,
      skills: resident.skills, relationships: resident.relationships, memories: resident.memories,
    }));
    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState()))));
    expect(loaded).not.toBeNull();
    const after = loaded!.world.cityLife.residents.map((resident) => ({
      npcId: resident.npcId, needs: resident.needs, attributes: resident.attributes,
      skills: resident.skills, relationships: resident.relationships, memories: resident.memories,
    }));
    expect(after).toEqual(before);
    expect(after.some((resident) => resident.memories.length > 0)).toBe(true);
    expect(after.some((resident) => Object.keys(resident.relationships).length > 0)).toBe(true);
  });
});
