/**
 * @test-target: src/core/contracts/actor-id.ts
 * @error-code: ERR-1002
 *
 * Contract actor-id v1.0: Dauerhafte Actor-ID und Referenzregeln.
 */
import { describe, expect, it } from 'vitest';
import type { ActorId } from '../actor-id';
import { ACTOR_ID_PREFIXES, createActorId, isActorId, actorIdPrefix } from '../actor-id';

describe('Contract: actor-id v1.0', () => {
  it('erstellt gültige Actor-IDs für alle Präfixe', () => {
    expect(createActorId('GUEST', 42)).toBe('guest_42');
    expect(createActorId('RIVAL', 7)).toBe('rival_7');
    expect(createActorId('VISITOR', 1)).toBe('visitor_1');
    expect(createActorId('STAFF', 3)).toBe('staff_3');
    expect(createActorId('PLAYER', 0)).toBe('player_0');
  });

  it('exportiert alle fünf Präfixe', () => {
    expect(Object.keys(ACTOR_ID_PREFIXES).sort()).toEqual(['GUEST', 'PLAYER', 'RIVAL', 'STAFF', 'VISITOR']);
    expect(ACTOR_ID_PREFIXES.GUEST).toBe('guest_');
    expect(ACTOR_ID_PREFIXES.RIVAL).toBe('rival_');
  });

  it('weist den korrekten Präfix zu', () => {
    expect(actorIdPrefix('guest_42')).toBe('GUEST');
    expect(actorIdPrefix('rival_7')).toBe('RIVAL');
    expect(actorIdPrefix('visitor_1')).toBe('VISITOR');
    expect(actorIdPrefix('staff_3')).toBe('STAFF');
    expect(actorIdPrefix('player_0')).toBe('PLAYER');
    expect(actorIdPrefix('unknown_99')).toBeNull();
  });

  it('erkennt gültige und ungültige Actor-IDs', () => {
    const valid: ActorId = 'guest_42';
    expect(isActorId(valid)).toBe(true);
    expect(isActorId('rival_7')).toBe(true);
    expect(isActorId('not-an-actor')).toBe(false);
    expect(isActorId(42)).toBe(false);
    expect(isActorId(null)).toBe(false);
    expect(isActorId(undefined)).toBe(false);
  });

  it('wirft bei ungültiger Sequenz', () => {
    expect(() => createActorId('GUEST', -1)).toThrow();
    expect(() => createActorId('GUEST', NaN)).toThrow();
  });

  it('liefert unterschiedliche Werte für unterschiedliche Actor-IDs', () => {
    const a = createActorId('GUEST', 1);
    const b = createActorId('RIVAL', 2);
    expect(a).not.toBe(b);
    expect(isActorId(a)).toBe(true);
    expect(isActorId(b)).toBe(true);
  });
});
