/**
 * @test-target: src/core/contracts/factor.ts
 * @error-code: ERR-1002
 *
 * Contract factor v1.0: Factor-IDs, Kontext und Contribution-Trace.
 */
import { describe, expect, it } from 'vitest';
import type { ActorId } from '../actor-id';
import type { RelationshipId, RelationshipType, RelationshipEdge } from '../relationship';
import type { FactorId, FactorContext, ContributionTrace, Factor } from '../factor';
import { createFactorId, createFactor, validateFactor } from '../factor';

describe('Contract: factor v1.0', () => {
  const sampleActor: ActorId = 'guest_42';
  const sampleEdge: RelationshipEdge = {
    edgeId: 'guest_42->player_1:VISITED' as RelationshipId,
    sourceActorId: 'guest_42' as ActorId,
    targetActorId: 'player_1' as ActorId,
    relationshipType: 'VISITED' as RelationshipType,
    stance: 0,
    goodwill: 50,
    history: [],
    clues: [],
  };

  it('erstellt einen gültigen Factor mit Kontext und Trace', () => {
    const factor: Factor = createFactor('factor_42', { zone: 'casino' }, ['contrib_1', 'contrib_2']);
    expect(factor.id).toBe('factor_42');
    expect(factor.context).toEqual({ zone: 'casino' });
    expect(factor.contributions).toEqual(['contrib_1', 'contrib_2']);
    expect(validateFactor(factor)).toBe(true);
  });

  it('lehnt leere Factor-ID ab', () => {
    expect(() => createFactorId('')).toThrow();
    expect(() => createFactor('', {}, [])).toThrow();
  });

  it('lehnt Kontext mit nicht-String-Werten ab', () => {
    const factor = createFactor('factor_42', { bad: 42 as unknown as string }, []);
    expect(validateFactor(factor)).toBe(false);
  });

  it('lehnt Trace mit nicht-String-Einträgen ab', () => {
    const factor = createFactor('factor_42', {}, [42 as unknown as string]);
    expect(validateFactor(factor)).toBe(false);
  });

  it('behandelt leeren Trace als gültig', () => {
    const factor: Factor = createFactor('factor_99', {}, []);
    expect(validateFactor(factor)).toBe(true);
    expect(factor.contributions).toHaveLength(0);
  });

  it('produziert deterministische Factor-IDs für gleiche Eingaben', () => {
    const id1 = createFactorId('factor_42');
    const id2 = createFactorId('factor_42');
    expect(id1).toBe(id2);
    expect(id1).toBe('factor_42');
  });

  it('verwendet alle importierten Typen ohne Raum- oder Objektrollen', () => {
    const id: FactorId = 'factor_1';
    const context: FactorContext = { key: 'value' };
    const trace: ContributionTrace = ['a', 'b'];
    const factor: Factor = createFactor(id, context, trace);
    expect(factor.id).toBe(id);
    expect(factor.context).toBe(context);
    expect(factor.contributions).toBe(trace);
    expect(sampleActor).toBe('guest_42');
    expect(sampleEdge.edgeId).toContain('guest_42');
  });
});
