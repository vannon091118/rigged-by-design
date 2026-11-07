/**
 * @test-target: src/core/contracts/relationship.ts
 * @error-code: ERR-1002
 *
 * Contract relationship v1.0: Gerichtete Relationship-IDs und erlaubte Änderungsbefehle.
 */
import { describe, expect, it } from 'vitest';
import type { ActorId, RelationshipEdge, RelationshipId, RelationshipType } from '../relationship';
import { createRelationshipEdge, validateRelationshipEdge } from '../relationship';

describe('Contract: relationship v1.0', () => {
  it('erstellt eine valide Relationship-Kante', () => {
    const sourceActorId: ActorId = 'guest_42';
    const targetActorId: ActorId = 'player_1';
    const relationshipType: RelationshipType = 'VISITED';
    const edge: RelationshipEdge = createRelationshipEdge(sourceActorId, targetActorId, relationshipType);
    const edgeId: RelationshipId = edge.edgeId;
    expect(edgeId).toBe('guest_42->player_1:VISITED');
    expect(edge.sourceActorId).toBe(sourceActorId);
    expect(edge.targetActorId).toBe(targetActorId);
    expect(edge.relationshipType).toBe(relationshipType);
    expect(edge.stance).toBe(0);
    expect(edge.goodwill).toBe(50);
    expect(edge.history).toEqual([]);
    expect(edge.clues).toEqual([]);
  });

  it('validiert eine korrekte Kante', () => {
    const edge: RelationshipEdge = createRelationshipEdge('rival_7', 'guest_42', 'SABOTAGED');
    expect(validateRelationshipEdge(edge)).toBe(true);
  });

  it('lehnt leere sourceActorId ab', () => {
    expect(() => createRelationshipEdge('', 'player_1', 'VISITED')).toThrow();
  });

  it('lehnt leeres targetActorId ab', () => {
    expect(() => createRelationshipEdge('guest_42', '', 'VISITED')).toThrow();
  });

  it('lehnt gleiche Quelle und Ziel ab', () => {
    expect(() => createRelationshipEdge('guest_42', 'guest_42', 'VISITED')).toThrow();
  });

  it('lehnt leeren relationshipType ab', () => {
    expect(() => createRelationshipEdge('guest_42', 'player_1', '')).toThrow();
  });

  it('lehnt stance außerhalb von -100 bis 100 ab', () => {
    const edge: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    expect(validateRelationshipEdge({ ...edge, stance: 101 })).toBe(false);
    expect(validateRelationshipEdge({ ...edge, stance: -101 })).toBe(false);
  });

  it('lehnt goodwill außerhalb von 0 bis 100 ab', () => {
    const edge: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    expect(validateRelationshipEdge({ ...edge, goodwill: 101 })).toBe(false);
    expect(validateRelationshipEdge({ ...edge, goodwill: -1 })).toBe(false);
  });

  it('lehnt mehr als 6 History-Einträge ab', () => {
    const edge: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    expect(
      validateRelationshipEdge({
        ...edge,
        history: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      }),
    ).toBe(false);
  });

  it('lehnt mehr als 4 Clues ab', () => {
    const edge: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    expect(
      validateRelationshipEdge({
        ...edge,
        clues: ['a', 'b', 'c', 'd', 'e'],
      }),
    ).toBe(false);
  });

  it('produziert deterministische edgeId für gleiche Eingaben', () => {
    const e1: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    const e2: RelationshipEdge = createRelationshipEdge('guest_42', 'player_1', 'VISITED');
    expect(e1.edgeId).toBe(e2.edgeId);
  });
});
