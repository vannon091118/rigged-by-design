/** @test-target: src/core/sim/narrative/events/definitions/city-encounter.ts | @error-code: ERR-4022 */
import { describe, expect, it } from 'vitest';
import { composeNarrative } from '../../../composer';
import { NARRATIVE_REGISTRY } from '../../../composer/registry.generated';
import { CITY_ENCOUNTER_TEMPLATE } from '../city-encounter';

const cityEventFragments = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === 'city-event');

describe('city-event content pool', () => {
  it('traegt mindestens 50 Stadtbegegnungen mit beiden Pflichtkontexten', () => {
    expect(cityEventFragments.length).toBeGreaterThanOrEqual(50);
    expect(cityEventFragments.every((fragment) =>
      fragment.contexts.includes('city') && fragment.contexts.includes('encounter'),
    )).toBe(true);
    expect(new Set(cityEventFragments.map((fragment) => fragment.text)).size)
      .toBe(cityEventFragments.length);
  });

  it('wird von der CITY_ENCOUNTER-BODY ausgelesen und variiert ueber Szenen-IDs', () => {
    const chosen = new Set<string>();
    for (let eventInstanceId = 1; eventInstanceId <= 8; eventInstanceId += 1) {
      const result = composeNarrative({
        locale: 'de',
        slots: CITY_ENCOUNTER_TEMPLATE.contentSlots,
        contexts: ['encounter'],
        requiredFlags: ['narrativ'],
        eventInstanceId,
      });
      const body = result.slots.find((slot) => slot.slotId === 'BODY');
      expect(body?.fallback).toBe(false);
      expect(body?.contributionId).toMatch(/^city-event-\d{2}$/);
      chosen.add(body?.contributionId ?? '');
    }
    expect(chosen.size).toBeGreaterThan(1);
  });
});
