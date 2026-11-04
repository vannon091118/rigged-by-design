/** @test-target: src/core/sim/narrative/trigger-schema.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import {
  isTriggerCondition, isTriggerDefinition, normalizeTriggerDefinition,
  type TriggerCondition,
} from '../narrative/trigger-schema';

const valid: TriggerCondition = {
  op: 'all',
  conditions: [
    { op: 'fact', kind: 'VISITOR_CONFLICT' },
    { op: 'actor-role', role: 'visitor' },
    { op: 'actor-is', ref: 'visitor:3' },
    {
      op: 'relationship-at-least',
      from: 'visitor:3',
      to: 'player',
      dimension: 'trust',
      value: -10,
    },
    { op: 'recent-fact', kind: 'VISITOR_CONFLICT', ticks: 20, minCount: 1 },
  ],
};

describe('Trigger-Schema', () => {
  it('akzeptiert vollstaendige, typisierte Definitionen', () => {
    expect(isTriggerCondition(valid)).toBe(true);
    expect(isTriggerDefinition({ id: 'streit', condition: valid })).toBe(true);
    expect(normalizeTriggerDefinition({ id: 'streit', condition: valid })).toEqual({
      id: 'streit',
      condition: valid,
    });
  });

  it('verwirft unbekannte Operatoren, falsche Fact-Arten und leere Listen', () => {
    expect(isTriggerCondition({ op: 'unknown' })).toBe(false);
    expect(isTriggerCondition({ op: 'all', conditions: [] })).toBe(false);
    expect(isTriggerCondition({ op: 'any', conditions: [] })).toBe(false);
    expect(isTriggerCondition({ op: 'not' })).toBe(false);
    expect(isTriggerCondition({ op: 'fact', kind: 'UNKNOWN' })).toBe(false);
    expect(isTriggerCondition({ op: 'visitor-memory', valence: 'GREAT' })).toBe(false);
    expect(isTriggerCondition({ op: 'house-band', band: 'HIGH' })).toBe(false);
    expect(isTriggerCondition({ op: 'rival-action', actions: ['SABOTAGE'] })).toBe(true);
    expect(isTriggerCondition({ op: 'rival-action', actions: ['PROBE'] })).toBe(true);
    expect(isTriggerCondition({ op: 'rival-action', actions: [] })).toBe(false);
    expect(isTriggerCondition({ op: 'rival-action', actions: ['SABOTAGE', 'SABOTAGE'] })).toBe(false);
    expect(isTriggerCondition({ op: 'rival-action', actions: ['UNKNOWN'] })).toBe(false);
  });

  it('verwirft negative, unsichere und ungueltige Schwellen sowie Refs', () => {
    expect(isTriggerCondition({ op: 'house-at-most', amount: -1 })).toBe(false);
    expect(isTriggerCondition({ op: 'reputation-at-least', value: 101 })).toBe(false);
    expect(isTriggerCondition({ op: 'fact-within', ticks: 1.5 })).toBe(false);
    expect(isTriggerCondition({ op: 'recent-fact', kind: 'VISIT_ENDED', minCount: 0 })).toBe(false);
    expect(isTriggerCondition({ op: 'flag-at-least', flag: 'open', value: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isTriggerCondition({ op: 'actor-is', ref: 'guest:1' })).toBe(false);
    expect(isTriggerCondition({
      op: 'relationship-at-least', from: 'visitor:1', to: 'visitor:1', dimension: 'trust', value: 1,
    })).toBe(false);
    expect(isTriggerCondition({
      op: 'relationship-at-most', from: 'visitor:1', to: 'player', dimension: 'fear', value: 1,
    })).toBe(false);
    expect(isTriggerCondition({
      op: 'relationship-at-most', from: 'visitor:1', to: 'player', dimension: 'trust', value: 11,
    })).toBe(false);
  });

  it('begrenzt Rekursionstiefe und Knotenzahl', () => {
    let deep: unknown = { op: 'damaged-device' };
    for (let index = 0; index < 14; index += 1) deep = { op: 'not', condition: deep };
    expect(isTriggerCondition(deep)).toBe(false);
    const wide = { op: 'all', conditions: Array.from({ length: 65 }, () => ({ op: 'damaged-device' })) };
    expect(isTriggerCondition(wide)).toBe(false);
  });

  it('verwirft kaputte Definitionen ohne gueltige ID oder Bedingung', () => {
    expect(isTriggerDefinition({ id: '', condition: valid })).toBe(false);
    expect(isTriggerDefinition({ id: 'x' })).toBe(false);
    expect(normalizeTriggerDefinition(null)).toBeNull();
    expect(normalizeTriggerDefinition({ id: 'x', condition: { op: 'unknown' } })).toBeNull();
  });
});
