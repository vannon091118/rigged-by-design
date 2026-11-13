/**
 * @test-target: src/core/sim/city-life-apply.ts
 * @error-code: ERR-2001
 *
 * Ortsgebundene Wirkung folgt der Ankunft: Wer erst noch laufen muss, bekommt
 * Lohn, Konsum und Kontakt nicht schon am Wohnungstisch (#504).
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { applyCityDecision } from '../city-life-apply';
import type { CityDecisionPlan } from '../city-life-decision';
import { createDefaultNeeds } from '../npc-needs';
import { createCityLifeState } from '../city-life-create';
import { tickCityMovement } from '../city-life-movement';
import { createWorld, ensureStarter } from '../templates';

function plan(): CityDecisionPlan {
  return {
    choice: {
      intent: 'WORK', location: 'MARKT', target: null, score: 0, alternatives: [], factors: [],
    },
    counterfactuals: [],
    memoryId: null,
    relationship: null,
    socialTarget: null,
    present: [],
  };
}

function resident() {
  const life = createCityLifeState(7, 3);
  return { ...life.residents[1]!, needs: createDefaultNeeds({ money: 1000 }), location: 'HOME' as const };
}

const inputFor = (target: ReturnType<typeof resident>) => ({
  resident: target,
  scheduled: 'WORK' as const,
  workplace: 'MARKT' as const,
  hour: 9,
  day: 1,
  tick: 10,
  peers: [],
  traits: [],
  seed: 7,
});

describe('Intent-Wirkung erst am Ort', () => {
  it('bucht waehrend der Reise nur die Zeitdauer, kein Geld', () => {
    const target = resident();
    const applied = applyCityDecision({
      input: inputFor(target), plan: plan(), decisionId: 1, elapsedHours: 1, nextMemoryId: 1,
      settled: false,
    });
    expect(applied.resident.needs.money).toBe(1000);
    expect(applied.resident.skills.work).toBe(target.skills.work);
    expect(applied.decision.outcome.moneyDelta).toBe(0);
  });

  it('bucht am Ort den Lohn', () => {
    const target = resident();
    const applied = applyCityDecision({
      input: inputFor(target), plan: plan(), decisionId: 1, elapsedHours: 1, nextMemoryId: 1,
      settled: true,
    });
    expect(applied.resident.needs.money).toBe(1350);
  });

  it('bucht Lohn und Arbeit erst bei der Ankunft in der Bewegung', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const life = createCityLifeState(7, 3);
    world.cityLife = {
      ...life,
      residents: life.residents.map((entry, index) => index === 0
        ? {
          ...entry, location: 'HOME' as const, intent: 'WORK' as const,
          needs: { ...entry.needs, money: 1000 },
          travel: { to: 'MARKT' as const, path: [{ x: 8, y: 12 }], index: 0 },
        }
        : entry),
    };
    tickCityMovement(world);
    const arrived = world.cityLife!.residents[0]!;
    expect(arrived.location).toBe('MARKT');
    expect(arrived.travel).toBeNull();
    expect(arrived.needs.money).toBe(1350);
    void new Ledger({});
  });
});
