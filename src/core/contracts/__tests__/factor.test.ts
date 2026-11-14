/**
 * @test-target: src/core/contracts/factor.ts
 * @error-code: ERR-1002
 *
 * Contract factor v1.1: IDs, Kategorie, Grundgewicht, Untereinfluesse,
 * Kontext und Contribution-Trace.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActorId } from '../actor-id';
import type { RelationshipId, RelationshipType, RelationshipEdge } from '../relationship';
import type {
  FactorId, FactorContext, ContributionTrace, Factor, FactorChild, FactorOptions,
} from '../factor';
import {
  FACTOR_CONTRACT_VERSION, createFactorId, createFactor, validateFactor,
} from '../factor';

describe('Contract: factor v1.1', () => {
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

  it('erstellt einen gueltigen Factor mit Defaults fuer alte Aufrufer', () => {
    const factor: Factor = createFactor('factor_42', { zone: 'casino' }, ['contrib_1', 'contrib_2']);
    expect(factor.id).toBe('factor_42');
    expect(factor.category).toBe('ALLGEMEIN');
    expect(factor.baseWeight).toBe(1);
    expect(factor.children).toEqual([]);
    expect(factor.context).toEqual({ zone: 'casino' });
    expect(factor.contributions).toEqual(['contrib_1', 'contrib_2']);
    expect(validateFactor(factor)).toBe(true);
  });

  it('traegt Kategorie, Grundgewicht und Untereinfluesse', () => {
    const child: FactorChild = {
      id: 'factor_42.child', category: 'ERINNERUNG', baseWeight: 0.5, weight: 0.25,
    };
    const options: FactorOptions = { category: 'ZUSTAND', baseWeight: 0.75, children: [child] };
    const factor = createFactor('factor_42', { zone: 'bar' }, ['contrib_1'], options);
    expect(factor.category).toBe('ZUSTAND');
    expect(factor.baseWeight).toBe(0.75);
    expect(factor.children).toEqual([child]);
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

  it('lehnt Trace mit nicht-String-Eintraegen ab', () => {
    const factor = createFactor('factor_42', {}, [42 as unknown as string]);
    expect(validateFactor(factor)).toBe(false);
  });

  it('lehnt leere Kategorie, ungueltiges Grundgewicht und doppelte Kinder ab', () => {
    expect(validateFactor(createFactor('factor_42', {}, [], { category: ' ' }))).toBe(false);
    expect(validateFactor(createFactor('factor_42', {}, [], { baseWeight: 1.1 }))).toBe(false);
    const child: FactorChild = { id: 'child', category: 'X', baseWeight: 1, weight: 0.5 };
    expect(validateFactor(createFactor('factor_42', {}, [], { children: [child, child] }))).toBe(false);
    expect(validateFactor(createFactor('factor_42', {}, [], {
      children: [{ ...child, weight: 2 }],
    }))).toBe(false);
  });

  it('haelt Code, Test und Referenz auf derselben Contract-Version', () => {
    const reference = readFileSync(
      new URL('../../../../docs/contracts/factor.md', import.meta.url),
      'utf8',
    );
    expect(FACTOR_CONTRACT_VERSION).toBe('1.1');
    expect(reference).toContain(`# Contract: factor v${FACTOR_CONTRACT_VERSION}`);
    expect(reference).toContain(`**Version:** ${FACTOR_CONTRACT_VERSION}`);
    for (const field of ['category', 'baseWeight', 'children']) {
      expect(reference).toContain(`\`${field}\``);
    }
    expect(reference).toContain('FactorChild');
    expect(reference).toContain('0..1');
    expect(reference).toContain('-1..1');
  });

  it('behandelt leeren Trace als gueltig', () => {
    const factor: Factor = createFactor('factor_99', {}, []);
    expect(validateFactor(factor)).toBe(true);
    expect(factor.contributions).toHaveLength(0);
  });

  it('produziert deterministische Factor-IDs fuer gleiche Eingaben', () => {
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
